import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { SourceRegistryModel } from '../models/SourceRegistry.js';
import { ScholarshipModel } from '../models/Scholarship.js';
import { ReviewQueueModel } from '../models/ReviewQueue.js';
import { crawlSource, verifyScholarshipLinks } from './crawler.js';
import { detectScholarshipDiffs } from './diff-detector.js';
import { AutomationState, ChangeCategory, ReviewStatus } from '../constants/enums.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

let schedulerInterval = null;
let isCycleRunning = false;

/**
 * Crawl a single source, verify all associated scholarship links,
 * automatically hide scholarships with inaccurate/broken links from the student app,
 * and enqueue any detected changes into the ReviewQueue for Admin approval.
 */
export async function processSource(source) {
  logger.info(`[SCHEDULER] Checking source: ${source.name} (${source.organization})`);

  let crawlResult = null;
  let crawlError = null;

  try {
    crawlResult = await crawlSource(source);

    // Update healthy metrics
    source.health.totalChecks = (source.health.totalChecks || 0) + 1;
    if (!crawlResult.linkCheck?.isBroken) {
      source.health.successfulChecks = (source.health.successfulChecks || 0) + 1;
      source.health.consecutiveFailures = 0;
      source.health.lastErrorMessage = '';
      if (source.automationState === AutomationState.QUARANTINED) {
        source.automationState = AutomationState.ACTIVE;
      }
      source.lastSuccessfulCheckAt = new Date();
    } else {
      source.health.consecutiveFailures = (source.health.consecutiveFailures || 0) + 1;
      source.health.lastErrorMessage = crawlResult.linkCheck.brokenReason;
    }

    source.health.lastStatusCode = crawlResult.httpStatus;
    source.health.lastDurationMs = crawlResult.durationMs;
    source.health.uptimePercentage = Math.round(
      ((source.health.successfulChecks || 0) / source.health.totalChecks) * 100
    );
    source.lastCheckedAt = new Date();
    source.lastContentHash = crawlResult.contentHash;
    await source.save();

    logger.info(
      `[SCHEDULER] ✅ Crawled ${source.name} (HTTP ${crawlResult.httpStatus}${crawlResult.linkCheck?.isBroken ? ' — BROKEN LINK' : ''})`
    );
  } catch (crawlErr) {
    crawlError = crawlErr;
    source.health.totalChecks = (source.health.totalChecks || 0) + 1;
    source.health.consecutiveFailures = (source.health.consecutiveFailures || 0) + 1;
    source.health.lastErrorMessage = crawlErr.message;
    source.health.uptimePercentage = Math.round(
      ((source.health.successfulChecks || 0) / source.health.totalChecks) * 100
    );
    source.lastCheckedAt = new Date();

    if (source.health.consecutiveFailures >= 3) {
      source.automationState = AutomationState.QUARANTINED;
      source.health.quarantinedAt = new Date();
      source.health.quarantineReason = `3 consecutive crawl failures: ${crawlErr.message}`;
      logger.warn(`[SCHEDULER] ⚠️ Quarantined source ${source.name} due to repeated failures.`);
    }

    await source.save();
    logger.error(`[SCHEDULER] ❌ Crawl failed for ${source.name}: ${crawlErr.message}`);
  }

  // Evaluate all active scholarships tied to this source (even if previously hidden for broken link)
  const associatedScholarships = await ScholarshipModel.find({
    'sourceAttribution.sourceId': source._id,
    isActive: true,
  });

  let enqueuedCount = 0;
  let brokenCount = 0;
  let restoredCount = 0;

  for (const scholarship of associatedScholarships) {
    const appUrl = scholarship.sourceAttribution?.applicationUrl?.trim();
    const officialUrl = scholarship.sourceAttribution?.officialSourceUrl?.trim();
    const sourceUrl = (source.targetScholarshipUrl || source.officialUrl || '').trim();

    let linkResult;
    if (crawlResult?.linkCheck && appUrl === sourceUrl && (!officialUrl || officialUrl === sourceUrl)) {
      linkResult = crawlResult.linkCheck;
    } else {
      linkResult = await verifyScholarshipLinks(scholarship);
    }

    const wasBroken = Boolean(scholarship.linkHealth?.isBroken);

    if (linkResult?.isBroken) {
      brokenCount++;
      scholarship.linkHealth = {
        isBroken: true,
        lastCheckedAt: new Date(),
        statusCode: linkResult.statusCode || 0,
        brokenReason: linkResult.brokenReason || 'Inaccurate or unreachable URL',
        checkedUrl: linkResult.checkedUrl || appUrl || officialUrl,
      };
      await scholarship.save();
      logger.warn(
        `[SCHEDULER] 🚫 Hidden "${scholarship.title}" from student mobile app due to inaccurate link: ${scholarship.linkHealth.brokenReason}`
      );
    } else if (linkResult && !linkResult.transientError) {
      if (wasBroken) {
        restoredCount++;
        logger.info(`[SCHEDULER] ✅ Link verified live again — restored "${scholarship.title}" to student mobile app.`);
      }
      scholarship.linkHealth = {
        isBroken: false,
        lastCheckedAt: new Date(),
        statusCode: linkResult.statusCode || 200,
        brokenReason: '',
        checkedUrl: linkResult.checkedUrl || appUrl || officialUrl,
      };
      await scholarship.save();
    }

    const diffResult = detectScholarshipDiffs(scholarship, crawlResult, linkResult);

    if (diffResult.hasChanges) {
      const primaryCategory = diffResult.changes[0].category;
      const existingQueue = await ReviewQueueModel.findOne({
        scholarshipId: scholarship._id,
        status: ReviewStatus.PENDING,
        ...(primaryCategory === ChangeCategory.LINK_BROKEN ? { category: ChangeCategory.LINK_BROKEN } : {}),
      });

      if (!existingQueue) {
        await ReviewQueueModel.create({
          sourceId: source._id,
          sourceName: source.name,
          scholarshipId: scholarship._id,
          scholarshipTitle: scholarship.title,
          category: primaryCategory,
          severity: diffResult.severity,
          status: ReviewStatus.PENDING,
          proposedChanges: diffResult.changes.map((c) => ({
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
          })),
          diffSnippet: diffResult.changes.map((c) => c.description).join('; '),
          evidenceUrl: linkResult?.checkedUrl || source.targetScholarshipUrl || source.officialUrl,
          confidenceScore: diffResult.confidenceScore,
        });

        enqueuedCount++;
        logger.info(
          `[SCHEDULER] 🔔 Queued change for ADMIN PERMISSION on "${scholarship.title}": ${diffResult.changes.map((c) => c.description).join('; ')}`
        );
      }
    }
  }

  return {
    success: !crawlError,
    error: crawlError?.message,
    httpStatus: crawlResult?.httpStatus || 0,
    durationMs: crawlResult?.durationMs || 0,
    enqueuedCount,
    brokenCount,
    restoredCount,
  };
}

/**
 * Execute one full check cycle across all active sources that are due (or all when forceAll=true)
 */
export async function runSchedulerCycle({ forceAll = false } = {}) {
  if (isCycleRunning) {
    logger.warn('[SCHEDULER] Previous cycle is still running. Skipping trigger.');
    return { skipped: true };
  }

  isCycleRunning = true;
  const cycleStart = Date.now();
  logger.info('====================================================');
  logger.info(`[SCHEDULER] ⏱️ Starting ${forceAll ? 'FULL ON-DEMAND' : 'Automated'} Source Monitoring & Link Audit Cycle...`);
  logger.info('====================================================');

  let checkedCount = 0;
  let totalEnqueued = 0;
  let totalBroken = 0;
  let totalRestored = 0;

  try {
    const query = forceAll ? {} : { automationState: AutomationState.ACTIVE };
    const activeSources = await SourceRegistryModel.find(query);

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    // Preload urgent source IDs (deadlines within 30 days get 6h cadence instead of 24h)
    const urgentScholarships = await ScholarshipModel.find({
      isActive: true,
      'deadlines.applicationDeadline': { $gte: new Date(), $lte: new Date(now + thirtyDaysMs) },
    }).select('sourceAttribution.sourceId');
    const urgentSourceIds = new Set(
      urgentScholarships.map((s) => s.sourceAttribution?.sourceId?.toString()).filter(Boolean)
    );

    const dueSources = forceAll
      ? activeSources
      : activeSources.filter((source) => {
          if (!source.lastCheckedAt) return true;
          const isUrgent = urgentSourceIds.has(source._id.toString());
          const configuredMins = source.checkIntervalMinutes || env.SOURCE_CHECK_INTERVAL_MINUTES || 720;
          const effectiveMins = isUrgent ? Math.min(configuredMins, 360) : Math.min(configuredMins, 720);
          return now - new Date(source.lastCheckedAt).getTime() >= effectiveMins * 60 * 1000;
        });

    logger.info(`[SCHEDULER] Found ${activeSources.length} sources (${dueSources.length} due for check).`);

    const concurrency = env.WORKER_CONCURRENCY || 3;
    for (let i = 0; i < dueSources.length; i += concurrency) {
      const batch = dueSources.slice(i, i + concurrency);
      const results = await Promise.all(batch.map((src) => processSource(src)));
      checkedCount += batch.length;
      for (const r of results) {
        totalEnqueued += r.enqueuedCount || 0;
        totalBroken += r.brokenCount || 0;
        totalRestored += r.restoredCount || 0;
      }
    }

    const durationSec = Math.round((Date.now() - cycleStart) / 1000);
    logger.info(
      `[SCHEDULER] ✨ Cycle complete in ${durationSec}s. Checked ${checkedCount} sources | Queued: ${totalEnqueued} | Broken/Hidden: ${totalBroken} | Restored: ${totalRestored}.`
    );

    return {
      skipped: false,
      checkedCount,
      totalEnqueued,
      totalBroken,
      totalRestored,
      durationSec,
    };
  } catch (err) {
    logger.error('[SCHEDULER] Error during monitoring cycle:', err);
    throw err;
  } finally {
    isCycleRunning = false;
  }
}

/**
 * Start the background scheduler
 * @param {Object} options
 * @param {number} [options.intervalMs] - Tick interval in ms (default: every 10 minutes)
 * @param {boolean} [options.runImmediately] - Run a cycle immediately on start
 */
export function startMonitorScheduler({ intervalMs = 10 * 60 * 1000, runImmediately = true } = {}) {
  if (schedulerInterval) {
    logger.warn('[SCHEDULER] Monitor Scheduler is already active.');
    return schedulerInterval;
  }

  logger.info(`🚀 [SCHEDULER] Initializing 24/7 Active Official Source & Link Monitor (Tick interval: ${Math.round(intervalMs / 60000)}m)`);

  if (runImmediately) {
    setTimeout(() => {
      runSchedulerCycle().catch((err) => logger.error('[SCHEDULER] Initial cycle error:', err));
    }, 5000);
  }

  schedulerInterval = setInterval(() => {
    runSchedulerCycle().catch((err) => logger.error('[SCHEDULER] Periodic cycle error:', err));
  }, intervalMs);

  return schedulerInterval;
}

export function stopMonitorScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[SCHEDULER] Monitor Scheduler stopped.');
  }
}

// Standalone CLI execution via `node src/worker/monitor-scheduler.js` (or `npm run worker`)
if (process.argv[1]?.endsWith('monitor-scheduler.js')) {
  async function runStandaloneWorker() {
    try {
      await connectDatabase();
      logger.info('🤖 ScholarBeacon Standalone Background Worker Active (PID: ' + process.pid + ')');
      
      startMonitorScheduler({ runImmediately: true });

      const shutdown = async (signal) => {
        logger.info(`Received ${signal}. Gracefully stopping worker...`);
        stopMonitorScheduler();
        await disconnectDatabase();
        process.exit(0);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (err) {
      logger.error('Worker failed to start:', err);
      process.exit(1);
    }
  }

  runStandaloneWorker();
}

