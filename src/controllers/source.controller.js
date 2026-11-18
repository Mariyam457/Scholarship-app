import { SourceRegistryModel } from '../models/SourceRegistry.js';
import { ScholarshipModel } from '../models/Scholarship.js';
import { ApiError } from '../utils/api-error.js';
import { slugify } from '../utils/text.utils.js';
import { crawlSource } from '../worker/crawler.js';
import { processSource, runSchedulerCycle } from '../worker/monitor-scheduler.js';
import { logAuditEvent } from '../services/audit.service.js';

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

    const result = await processSource(source);
    if (!result.success) {
      return next(ApiError.badRequest(`Crawl execution failed: ${result.error}`));
    }

    res.json({
      success: true,
      message: `Crawl completed for ${source.name}.`,
      data: {
        httpStatus: result.httpStatus,
        durationMs: result.durationMs,
        enqueuedReviewItemsCount: result.enqueuedCount,
        brokenLinksHiddenCount: result.brokenCount,
        restoredLinksCount: result.restoredCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function triggerCrawlAll(req, res, next) {
  try {
    const summary = await runSchedulerCycle({ forceAll: true });
    if (summary?.skipped) {
      return next(ApiError.badRequest('A crawl audit cycle is already running. Please wait a moment and try again.'));
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SOURCE_CRAWL_ALL',
      entityType: 'SourceRegistry',
      entityId: 'all',
      changes: summary,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Full link audit & crawl complete across ${summary.checkedCount} sources.`,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}
