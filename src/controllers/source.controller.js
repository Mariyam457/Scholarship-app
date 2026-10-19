import { SourceRegistryModel } from '../models/SourceRegistry.js';
import { ScholarshipModel } from '../models/Scholarship.js';
import { ReviewQueueModel } from '../models/ReviewQueue.js';
import { ApiError } from '../utils/api-error.js';
import { slugify } from '../utils/text.utils.js';
import { crawlSource } from '../worker/crawler.js';
import { detectScholarshipDiffs } from '../worker/diff-detector.js';
import { logAuditEvent } from '../services/audit.service.js';
import { AutomationState, ReviewStatus, Severity } from '../constants/enums.js';

export async function listSources(req, res, next) {
  try {
    const sources = await SourceRegistryModel.find().sort({ name: 1 });
    res.json({
      success: true,
      data: { sources },
    });
  } catch (error) {
    next(error);
  }
}

export async function getSourceById(req, res, next) {
  try {
    const { id } = req.params;
    const source = await SourceRegistryModel.findById(id);
    if (!source) {
      return next(ApiError.notFound('Source not found'));
    }

    const associatedScholarships = await ScholarshipModel.find({
      'sourceAttribution.sourceId': id,
    }).select('title deadlines verificationStatus slug');

    res.json({
      success: true,
      data: {
        source,
        associatedScholarships,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createSource(req, res, next) {
  try {
    const payload = req.body;
    let baseSlug = slugify(payload.name);
    let slug = baseSlug;
    let counter = 1;
    while (await SourceRegistryModel.exists({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const source = await SourceRegistryModel.create({
      ...payload,
      slug,
      health: {
        consecutiveFailures: 0,
        totalChecks: 0,
        successfulChecks: 0,
        uptimePercentage: 100,
      },
    });

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SOURCE_REGISTER',
      entityType: 'SourceRegistry',
      entityId: source._id.toString(),
      changes: payload,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Official source registered successfully',
      data: { source },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSource(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const source = await SourceRegistryModel.findByIdAndUpdate(id, updates, { new: true });
    if (!source) {
      return next(ApiError.notFound('Source not found'));
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SOURCE_UPDATE',
      entityType: 'SourceRegistry',
      entityId: id,
      changes: updates,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Source updated successfully',
      data: { source },
    });
  } catch (error) {
    next(error);
  }
}

export async function testSource(req, res, next) {
  try {
    const testConfig = req.body;
    const crawlResult = await crawlSource(testConfig);

    res.json({
      success: true,
      message: 'Test crawl completed successfully',
      data: {
        status: crawlResult.httpStatus,
        durationMs: crawlResult.durationMs,
        contentHash: crawlResult.contentHash,
        extracted: crawlResult.extractedData,
        previewSnippet: crawlResult.rawSnippet.slice(0, 500),
      },
    });
  } catch (error) {
    next(ApiError.badRequest(`Source test failed: ${error.message}`));
  }
}

export async function triggerCrawl(req, res, next) {
  try {
    const { id } = req.params;
    const source = await SourceRegistryModel.findById(id);
    if (!source) {
      return next(ApiError.notFound('Source not found'));
    }

    let crawlResult;
    try {
      crawlResult = await crawlSource(source);

      // Update success health metrics
      source.health.totalChecks += 1;
      source.health.successfulChecks += 1;
      source.health.consecutiveFailures = 0;
      source.health.lastStatusCode = crawlResult.httpStatus;
      source.health.lastDurationMs = crawlResult.durationMs;
      source.health.uptimePercentage = Math.round(
        (source.health.successfulChecks / source.health.totalChecks) * 100
      );
      source.lastCheckedAt = new Date();
      source.lastSuccessfulCheckAt = new Date();
      source.lastContentHash = crawlResult.contentHash;
    } catch (crawlErr) {
      // Update failure health metrics
      source.health.totalChecks += 1;
      source.health.consecutiveFailures += 1;
      source.health.lastErrorMessage = crawlErr.message;
      source.health.uptimePercentage = Math.round(
        (source.health.successfulChecks / source.health.totalChecks) * 100
      );
      source.lastCheckedAt = new Date();

      if (source.health.consecutiveFailures >= 3) {
        source.automationState = AutomationState.QUARANTINED;
        source.health.quarantinedAt = new Date();
        source.health.quarantineReason = `3 consecutive crawl failures: ${crawlErr.message}`;
      }

      await source.save();
      return next(ApiError.badRequest(`Crawl execution failed: ${crawlErr.message}`));
    }

    await source.save();

    // Check diff against associated scholarships
    const associatedScholarships = await ScholarshipModel.find({
      'sourceAttribution.sourceId': source._id,
      isActive: true,
    });

    let detectedChangesCount = 0;
    const enqueuedItems = [];

    for (const scholarship of associatedScholarships) {
      const diffResult = detectScholarshipDiffs(scholarship, crawlResult);
      if (diffResult.hasChanges) {
        detectedChangesCount += diffResult.changes.length;

        // Check if pending queue item already exists
        const existingQueue = await ReviewQueueModel.findOne({
          scholarshipId: scholarship._id,
          status: ReviewStatus.PENDING,
        });

        if (!existingQueue) {
          const queueItem = await ReviewQueueModel.create({
            sourceId: source._id,
            sourceName: source.name,
            scholarshipId: scholarship._id,
            scholarshipTitle: scholarship.title,
            category: diffResult.changes[0].category,
            severity: diffResult.severity,
            status: ReviewStatus.PENDING,
            proposedChanges: diffResult.changes.map((c) => ({
              field: c.field,
              oldValue: c.oldValue,
              newValue: c.newValue,
            })),
            diffSnippet: diffResult.changes.map((c) => c.description).join('; '),
            evidenceUrl: source.targetScholarshipUrl,
            confidenceScore: diffResult.confidenceScore,
          });
          enqueuedItems.push(queueItem);
        }
      }
    }

    res.json({
      success: true,
      message: `Crawl completed for ${source.name}.`,
      data: {
        httpStatus: crawlResult.httpStatus,
        durationMs: crawlResult.durationMs,
        detectedChangesCount,
        enqueuedReviewItemsCount: enqueuedItems.length,
        enqueuedItems,
      },
    });
  } catch (error) {
    next(error);
  }
}
