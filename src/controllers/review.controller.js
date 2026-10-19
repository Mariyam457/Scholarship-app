import { ReviewQueueModel } from '../models/ReviewQueue.js';
import { ScholarshipModel } from '../models/Scholarship.js';
import { ApiError } from '../utils/api-error.js';
import { logAuditEvent } from '../services/audit.service.js';
import { ReviewStatus } from '../constants/enums.js';

export async function listQueue(req, res, next) {
  try {
    const { status = ReviewStatus.PENDING, page = 1, limit = 20 } = req.query;
    const query = status === 'all' ? {} : { status };

    const skip = (Number(page) - 1) * Number(limit);
    const [total, items] = await Promise.all([
      ReviewQueueModel.countDocuments(query),
      ReviewQueueModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('sourceId', 'name officialUrl targetScholarshipUrl')
        .populate('scholarshipId', 'title slug deadlines verificationStatus'),
    ]);

    res.json({
      success: true,
      data: { items },
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getQueueItem(req, res, next) {
  try {
    const { id } = req.params;
    const item = await ReviewQueueModel.findById(id)
      .populate('sourceId', 'name officialUrl targetScholarshipUrl')
      .populate('scholarshipId');

    if (!item) {
      return next(ApiError.notFound('Review queue item not found'));
    }

    res.json({
      success: true,
      data: { item },
    });
  } catch (error) {
    next(error);
  }
}

export async function approveChange(req, res, next) {
  try {
    const { id } = req.params;
    const item = await ReviewQueueModel.findById(id);

    if (!item) {
      return next(ApiError.notFound('Review item not found'));
    }

    if (item.status !== ReviewStatus.PENDING) {
      return next(ApiError.badRequest(`Item already ${item.status}`));
    }

    // Apply proposed changes to scholarship
    if (item.scholarshipId) {
      const updateDoc = {};
      for (const change of item.proposedChanges) {
        updateDoc[change.field] = change.newValue;
      }
      updateDoc['sourceAttribution.lastVerifiedAt'] = new Date();
      updateDoc['sourceAttribution.verificationMethod'] = 'human_approved_crawl';

      await ScholarshipModel.findByIdAndUpdate(item.scholarshipId, updateDoc);
    }

    item.status = ReviewStatus.APPROVED;
    item.reviewedBy = req.user.id;
    item.reviewedAt = new Date();
    await item.save();

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'REVIEW_QUEUE_APPROVE',
      entityType: 'ReviewQueue',
      entityId: id,
      changes: item.proposedChanges,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Changes approved and applied to scholarship',
      data: { item },
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectChange(req, res, next) {
  try {
    const { id } = req.params;
    const { rejectionReason = 'Rejected by administrator' } = req.body;

    const item = await ReviewQueueModel.findById(id);
    if (!item) {
      return next(ApiError.notFound('Review item not found'));
    }

    if (item.status !== ReviewStatus.PENDING) {
      return next(ApiError.badRequest(`Item already ${item.status}`));
    }

    item.status = ReviewStatus.REJECTED;
    item.reviewedBy = req.user.id;
    item.reviewedAt = new Date();
    item.rejectionReason = rejectionReason;
    await item.save();

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'REVIEW_QUEUE_REJECT',
      entityType: 'ReviewQueue',
      entityId: id,
      changes: { rejectionReason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Proposed change rejected',
      data: { item },
    });
  } catch (error) {
    next(error);
  }
}
