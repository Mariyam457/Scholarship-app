import { z } from 'zod';
import { SourceMethod, AutomationState } from '../constants/enums.js';

export const createSourceSchema = z.object({
  name: z.string().min(3).max(150).trim(),
  organization: z.string().min(2).max(150).trim(),
  officialUrl: z.string().url(),
  targetScholarshipUrl: z.string().url(),
  method: z.nativeEnum(SourceMethod).default(SourceMethod.CRAWL),
  crawlConfig: z
    .object({
      selectorTitle: z.string().optional(),
      selectorDeadline: z.string().optional(),
      selectorEligibility: z.string().optional(),
      selectorDescription: z.string().optional(),
      selectorFunding: z.string().optional(),
      headers: z.record(z.string()).optional(),
      rateLimitDelayMs: z.number().min(500).default(2000),
      paginationSelector: z.string().optional(),
      pdfDownloadUrlSelector: z.string().optional(),
    })
    .optional(),
  apiConfig: z
    .object({
      endpoint: z.string().url(),
      method: z.enum(['GET', 'POST']).default('GET'),
      headers: z.record(z.string()).optional(),
      dataPath: z.string().optional(),
      deadlineField: z.string().optional(),
    })
    .optional(),
  checkIntervalMinutes: z.number().min(60).default(1440),
  automationState: z.nativeEnum(AutomationState).default(AutomationState.ACTIVE),
  autoApplyThreshold: z.number().min(0).max(100).default(90),
});

export const updateSourceSchema = createSourceSchema.partial();

export const reviewQueueActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().max(500).optional(),
});
