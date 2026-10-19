import mongoose from 'mongoose';
import { ChangeCategory, Severity, ReviewStatus } from '../constants/enums.js';

const ReviewQueueSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SourceRegistry',
      required: true,
      index: true,
    },
    sourceName: { type: String, required: true },
    scholarshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scholarship',
      index: true,
    },
    scholarshipTitle: { type: String, required: true },
    category: {
      type: String,
      enum: Object.values(ChangeCategory),
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(Severity),
      default: Severity.MEDIUM,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ReviewStatus),
      default: ReviewStatus.PENDING,
      index: true,
    },
    proposedChanges: [
      {
        field: { type: String, required: true },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    diffSnippet: { type: String, default: '' },
    evidenceUrl: { type: String, required: true },
    aiSummary: { type: String },
    confidenceScore: { type: Number, min: 0, max: 100, default: 85 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
  },
  {
    timestamps: true,
  }
);

export const ReviewQueueModel = mongoose.model('ReviewQueue', ReviewQueueSchema);
