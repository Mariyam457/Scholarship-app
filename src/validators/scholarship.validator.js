import { z } from 'zod';
import { DegreeLevel, FundingType, VerificationStatus, GenderRequirement } from '../constants/enums.js';

export const scholarshipFilterSchema = z.object({
  search: z.string().optional(),
  hostCountries: z.union([z.string(), z.array(z.string())]).optional().transform((val) => {
    if (!val) return undefined;
    return Array.isArray(val) ? val : val.split(',').map((s) => s.trim().toUpperCase());
  }),
  degreeLevels: z.union([z.string(), z.array(z.string())]).optional().transform((val) => {
    if (!val) return undefined;
    return Array.isArray(val) ? val : val.split(',').map((s) => s.trim().toLowerCase());
  }),
  fundingTypes: z.union([z.string(), z.array(z.string())]).optional().transform((val) => {
    if (!val) return undefined;
    return Array.isArray(val) ? val : val.split(',').map((s) => s.trim().toLowerCase());
  }),
  fieldsOfStudy: z.union([z.string(), z.array(z.string())]).optional().transform((val) => {
    if (!val) return undefined;
    return Array.isArray(val) ? val : val.split(',').map((s) => s.trim());
  }),
  nationality: z.string().optional(),
  minGpa: z.coerce.number().min(0).max(10).optional(),
  deadlineBefore: z.string().optional(),
  deadlineAfter: z.string().optional(),
  verificationStatus: z.nativeEnum(VerificationStatus).optional(),
  isRolling: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['deadline', 'createdAt', 'title', 'confidenceScore']).default('deadline'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const createScholarshipSchema = z.object({
  title: z.string().min(5).max(300).trim(),
  provider: z.string().min(2).max(200).trim(),
  hostCountries: z.array(z.string().min(2).max(10)).min(1),
  description: z.string().min(20),
  overview: z.string().min(10).max(500),
  degreeLevels: z.array(z.nativeEnum(DegreeLevel)).min(1),
  fieldsOfStudy: z.array(z.string()).min(1),
  fundingType: z.nativeEnum(FundingType),
  fundingBreakdown: z.object({
    tuitionCovered: z.boolean(),
    tuitionPercentage: z.number().min(0).max(100).optional(),
    livingStipend: z.object({
      provided: z.boolean(),
      amount: z.number().optional(),
      currency: z.string().optional(),
      frequency: z.enum(['monthly', 'yearly', 'one_time']).optional(),
    }),
    travelAllowance: z.object({
      flightTicketsProvided: z.boolean(),
      amount: z.number().optional(),
      currency: z.string().optional(),
    }),
    healthInsurance: z.boolean(),
    visaFeesCovered: z.boolean(),
    booksAllowance: z.boolean(),
    notes: z.string().optional(),
  }),
  eligibility: z.object({
    minGpa: z.number().min(0).max(10).optional(),
    gpaScale: z.number().min(1).max(100).optional(),
    maxAge: z.number().min(12).max(100).optional(),
    eligibleNationalities: z.array(z.string()).min(1),
    ineligibleNationalities: z.array(z.string()).optional(),
    genderRequirement: z.nativeEnum(GenderRequirement).default(GenderRequirement.ALL),
    degreeLevels: z.array(z.nativeEnum(DegreeLevel)).min(1),
    fieldsOfStudy: z.array(z.string()).min(1),
    languageRequirements: z
      .array(
        z.object({
          test: z.enum(['IELTS', 'TOEFL', 'PTE', 'DUOLINGO', 'NONE', 'OTHER']),
          minScore: z.string(),
        })
      )
      .default([]),
    workExperienceRequiredYears: z.number().min(0).optional(),
    requiredDocuments: z.array(z.string()).default([]),
    notes: z.string().optional(),
  }),
  deadlines: z.object({
    applicationStart: z.string().or(z.date()).optional(),
    applicationDeadline: z.string().or(z.date()),
    academicYear: z.string().min(4),
    timezone: z.string().optional(),
    isRolling: z.boolean().default(false),
  }),
  sourceAttribution: z.object({
    sourceId: z.string(),
    sourceName: z.string(),
    officialSourceUrl: z.string().url(),
    applicationUrl: z.string().url(),
    lastVerifiedAt: z.string().or(z.date()).default(() => new Date()),
    verificationMethod: z.string().default('manual_entry'),
    confidenceScore: z.number().min(0).max(100).default(100),
  }),
  verificationStatus: z.nativeEnum(VerificationStatus).default(VerificationStatus.VERIFIED),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export const updateScholarshipSchema = createScholarshipSchema.partial();
