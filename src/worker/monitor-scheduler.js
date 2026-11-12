import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { SourceRegistryModel } from '../models/SourceRegistry.js';
import { ScholarshipModel } from '../models/Scholarship.js';
import { ReviewQueueModel } from '../models/ReviewQueue.js';
import { crawlSource } from './crawler.js';
import { detectScholarshipDiffs } from './diff-detector.js';
import { AutomationState, ReviewStatus, Severity } from '../constants/enums.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

let schedulerInterval = null;
let isCycleRunning = false;

/**
 * Crawl a single source, detect differences against existing scholarships,
 * and enqueue any detected changes into the ReviewQueue for Admin approval.
 */
export async function processSource(source) {
  logger.info(`[SCHEDULER] Checking source: ${source.name} (${source.organization})`);

  let crawlResult;
  try {
    crawlResult = await crawlSource(source);

    // Update healthy metrics
    source.health.totalChecks = (source.health.totalChecks || 0) + 1;
    source.health.successfulChecks = (source.health.successfulChecks || 0) + 1;
    source.health.consecutiveFailures = 0;
    source.health.lastStatusCode = crawlResult.httpStatus;
    source.health.lastDurationMs = crawlResult.durationMs;
    source.health.uptimePercentage = Math.round(
      (source.health.successfulChecks / source.health.totalChecks) * 100
    );
    source.lastCheckedAt = new Date();
    source.lastSuccessfulCheckAt = new Date();
    source.lastContentHash = crawlResult.contentHash;
    await source.save();

    logger.info(`[SCHEDULER] ✅ Crawled ${source.name} successfully (status ${crawlResult.httpStatus})`);
  } catch (crawlErr) {
    source.health.totalChecks = (source.health.totalChecks || 0) + 1;
    source.health.consecutiveFailures = (source.health.consecutiveFailures || 0) + 1;
    source.health.lastErrorMessage = crawlErr.message;
    source.health.uptimePercentage = Math.round(
      (source.health.successfulChecks / source.health.totalChecks) * 100
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
    return { success: false, error: crawlErr.message };
  }

  // Find scholarships tied to this source
  const associatedScholarships = await ScholarshipModel.find({
    'sourceAttribution.sourceId': source._id,
    isActive: true,
  });

  let enqueuedCount = 0;

  for (const scholarship of associatedScholarships) {
    const diffResult = detectScholarshipDiffs(scholarship, crawlResult);

    if (diffResult.hasChanges) {
      // Check if there is already a pending review for this scholarship to avoid duplicate spam
      const existingQueue = await ReviewQueueModel.findOne({
        scholarshipId: scholarship._id,
        status: ReviewStatus.PENDING,
      });

      if (!existingQueue) {
        await ReviewQueueModel.create({
          sourceId: source._id,
          sourceName: source.name,
          scholarshipId: scholarship._id,
          scholarshipTitle: scholarship.title,
          category: diffResult.changes[0].category,
          severity: diffResult.severity,
          status: ReviewStatus.PENDING, // Awaiting admin permission/approval
          proposedChanges: diffResult.changes.map((c) => ({
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
          })),
          diffSnippet: diffResult.changes.map((c) => c.description).join('; '),
          evidenceUrl: source.targetScholarshipUrl || source.officialUrl,
          confidenceScore: diffResult.confidenceScore,
        });

        enqueuedCount++;
        logger.info(
          `[SCHEDULER] 🔔 Queued change for ADMIN PERMISSION on "${scholarship.title}": ${diffResult.changes.map((c) => c.description).join('; ')}`
        );
      }
    }
  }

  return { success: true, enqueuedCount };
}

/**
 * Execute one full check cycle across all active sources that are due
 */
export async function runSchedulerCycle() {
  if (isCycleRunning) {
    logger.warn('[SCHEDULER] Previous cycle is still running. Skipping trigger.');
    return;
  }

  isCycleRunning = true;
  const cycleStart = Date.now();
  logger.info('====================================================');
  logger.info('[SCHEDULER] ⏱️ Starting Automated Source Monitoring Cycle...');
  logger.info('====================================================');

  try {
    const activeSources = await SourceRegistryModel.find({
      automationState: AutomationState.ACTIVE,
    });

    const now = Date.now();
    const dueSources = activeSources.filter((source) => {
      if (!source.lastCheckedAt) return true;
      const intervalMs = (source.checkIntervalMinutes || env.SOURCE_CHECK_INTERVAL_MINUTES || 1440) * 60 * 1000;
      return now - new Date(source.lastCheckedAt).getTime() >= intervalMs;
    });

    logger.info(`[SCHEDULER] Found ${activeSources.length} active sources (${dueSources.length} due for check).`);

    // Process due sources with controlled concurrency
    const concurrency = env.WORKER_CONCURRENCY || 2;
    for (let i = 0; i < dueSources.length; i += concurrency) {
      const batch = dueSources.slice(i, i + concurrency);
      await Promise.all(batch.map((src) => processSource(src)));
    }

    const durationSec = Math.round((Date.now() - cycleStart) / 1000);
    logger.info(`[SCHEDULER] ✨ Cycle complete in ${durationSec}s. Checked ${dueSources.length} sources.`);
  } catch (err) {
    logger.error('[SCHEDULER] Error during monitoring cycle:', err);
  } finally {
    isCycleRunning = false;
  }
}

/**
 * Start the background scheduler
 * @param {Object} options
 * @param {number} [options.intervalMs] - Check interval in ms (default: every 15 minutes)
 * @param {boolean} [options.runImmediately] - Run a cycle immediately on start
 */
export function startMonitorScheduler({ intervalMs = 15 * 60 * 1000, runImmediately = true } = {}) {
  if (schedulerInterval) {
    logger.warn('[SCHEDULER] Monitor Scheduler is already active.');
    return schedulerInterval;
  }

  logger.info(`🚀 [SCHEDULER] Initializing 24/7 Official Source Monitor (Tick interval: ${Math.round(intervalMs / 60000)}m)`);

  if (runImmediately) {
    setTimeout(() => {
      runSchedulerCycle().catch((err) => logger.error('[SCHEDULER] Initial cycle error:', err));
    }, 5000); // 5s initial delay for clean startup
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

