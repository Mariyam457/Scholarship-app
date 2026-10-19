import mongoose from 'mongoose';
import { SourceMethod, AutomationState } from '../constants/enums.js';

const SourceRegistrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    organization: { type: String, required: true, trim: true },
    officialUrl: { type: String, required: true, trim: true },
    targetScholarshipUrl: { type: String, required: true, trim: true },
    method: {
      type: String,
      enum: Object.values(SourceMethod),
      default: SourceMethod.CRAWL,
    },
    crawlConfig: {
      selectorTitle: { type: String },
      selectorDeadline: { type: String },
      selectorEligibility: { type: String },
      selectorDescription: { type: String },
      selectorFunding: { type: String },
      headers: { type: Map, of: String },
      rateLimitDelayMs: { type: Number, default: 2000 },
      paginationSelector: { type: String },
      pdfDownloadUrlSelector: { type: String },
    },
    apiConfig: {
      endpoint: { type: String },
      method: { type: String, enum: ['GET', 'POST'], default: 'GET' },
      headers: { type: Map, of: String },
      dataPath: { type: String },
      deadlineField: { type: String },
    },
    checkIntervalMinutes: { type: Number, default: 1440 },
    automationState: {
      type: String,
      enum: Object.values(AutomationState),
      default: AutomationState.ACTIVE,
      index: true,
    },
    health: {
      consecutiveFailures: { type: Number, default: 0 },
      lastStatusCode: { type: Number },
      lastDurationMs: { type: Number },
      totalChecks: { type: Number, default: 0 },
      successfulChecks: { type: Number, default: 0 },
      uptimePercentage: { type: Number, default: 100 },
      lastErrorMessage: { type: String },
      quarantinedAt: { type: Date },
      quarantineReason: { type: String },
    },
    lastCheckedAt: { type: Date },
    lastSuccessfulCheckAt: { type: Date },
    lastContentHash: { type: String },
    autoApplyThreshold: { type: Number, default: 90 },
  },
  {
    timestamps: true,
  }
);

export const SourceRegistryModel = mongoose.model('SourceRegistry', SourceRegistrySchema);
