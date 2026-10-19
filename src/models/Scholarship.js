import mongoose from 'mongoose';
import { DegreeLevel, FundingType, VerificationStatus, GenderRequirement } from '../constants/enums.js';

const ScholarshipSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    provider: { type: String, required: true, trim: true, index: true },
    hostCountries: [{ type: String, uppercase: true, required: true, index: true }],
    description: { type: String, required: true },
    overview: { type: String, required: true },
    degreeLevels: [
      {
        type: String,
        enum: Object.values(DegreeLevel),
        required: true,
        index: true,
      },
    ],
    fieldsOfStudy: [{ type: String, index: true }],
    fundingType: {
      type: String,
      enum: Object.values(FundingType),
      required: true,
      index: true,
    },
    fundingBreakdown: {
      tuitionCovered: { type: Boolean, default: false },
      tuitionPercentage: { type: Number },
      livingStipend: {
        provided: { type: Boolean, default: false },
        amount: { type: Number },
        currency: { type: String, default: 'USD' },
        frequency: {
          type: String,
          enum: ['monthly', 'yearly', 'one_time'],
        },
      },
      travelAllowance: {
        flightTicketsProvided: { type: Boolean, default: false },
        amount: { type: Number },
        currency: { type: String, default: 'USD' },
      },
      healthInsurance: { type: Boolean, default: false },
      visaFeesCovered: { type: Boolean, default: false },
      booksAllowance: { type: Boolean, default: false },
      notes: { type: String },
    },
    eligibility: {
      minGpa: { type: Number },
      gpaScale: { type: Number, default: 4.0 },
      maxAge: { type: Number },
      eligibleNationalities: [{ type: String, uppercase: true, default: ['ALL'] }],
      ineligibleNationalities: [{ type: String, uppercase: true }],
      genderRequirement: {
        type: String,
        enum: Object.values(GenderRequirement),
        default: GenderRequirement.ALL,
      },
      degreeLevels: [{ type: String, enum: Object.values(DegreeLevel) }],
      fieldsOfStudy: [{ type: String }],
      languageRequirements: [
        {
          test: {
            type: String,
            enum: ['IELTS', 'TOEFL', 'PTE', 'DUOLINGO', 'NONE', 'OTHER'],
          },
          minScore: { type: String },
        },
      ],
      workExperienceRequiredYears: { type: Number, default: 0 },
      requiredDocuments: [{ type: String }],
      notes: { type: String },
    },
    deadlines: {
      applicationStart: { type: Date },
      applicationDeadline: { type: Date, required: true, index: true },
      academicYear: { type: String, required: true },
      timezone: { type: String, default: 'UTC' },
      isRolling: { type: Boolean, default: false },
    },
    sourceAttribution: {
      sourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SourceRegistry', required: true, index: true },
      sourceName: { type: String, required: true },
      officialSourceUrl: { type: String, required: true },
      applicationUrl: { type: String, required: true },
      lastVerifiedAt: { type: Date, default: Date.now },
      lastCheckedAt: { type: Date },
      verificationMethod: { type: String, default: 'official_crawl' },
      confidenceScore: { type: Number, min: 0, max: 100, default: 100 },
      sourceSnapshotHash: { type: String },
    },
    verificationStatus: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.VERIFIED,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    tags: [{ type: String, index: true }],
    viewCount: { type: Number, default: 0 },
    savedCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast searching and multi-attribute filters
ScholarshipSchema.index({ isActive: 1, verificationStatus: 1, 'deadlines.applicationDeadline': 1 });
ScholarshipSchema.index({ hostCountries: 1, degreeLevels: 1, fundingType: 1 });
ScholarshipSchema.index(
  {
    title: 'text',
    provider: 'text',
    description: 'text',
    overview: 'text',
    tags: 'text',
  },
  {
    weights: {
      title: 10,
      provider: 5,
      tags: 3,
      overview: 2,
      description: 1,
    },
    name: 'ScholarshipTextIndex',
  }
);

export const ScholarshipModel = mongoose.model('Scholarship', ScholarshipSchema);
