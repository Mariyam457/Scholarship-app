import { z } from 'zod';
import { ApplicationStatus } from '../constants/enums.js';

export const createApplicationSchema = z.object({
  scholarshipId: z.string().min(1, 'Scholarship ID is required'),
  status: z.nativeEnum(ApplicationStatus).default(ApplicationStatus.SAVED),
  notes: z.string().max(2000).optional(),
  checklist: z
    .array(
      z.object({
        task: z.string().min(1),
        completed: z.boolean().default(false),
        dueDate: z.string().or(z.date()).optional(),
      })
    )
    .optional(),
  appliedDate: z.string().or(z.date()).optional(),
});

export const updateApplicationSchema = z.object({
  status: z.nativeEnum(ApplicationStatus).optional(),
  notes: z.string().max(2000).optional(),
  checklist: z
    .array(
      z.object({
        task: z.string(),
        completed: z.boolean(),
        dueDate: z.string().or(z.date()).optional(),
      })
    )
    .optional(),
  appliedDate: z.string().or(z.date()).optional(),
  decisionDate: z.string().or(z.date()).optional(),
});
