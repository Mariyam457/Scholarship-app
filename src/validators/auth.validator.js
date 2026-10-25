import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Please provide a valid email address').trim().toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100).trim(),
  nationality: z.string().min(2, 'Nationality is required').max(10).trim(),
  residenceCountry: z.string().min(2, 'Country of residence is required').max(10).trim(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  nationality: z.string().min(2).max(10).optional(),
  residenceCountry: z.string().min(2).max(10).optional(),
  currentEducationLevel: z.string().optional(),
  targetDegreeLevels: z.array(z.string()).optional(),
  fieldOfStudy: z.string().max(100).optional(),
  gpa: z.number().min(0).max(10).optional(),
  gpaScale: z.number().min(1).max(100).optional(),
  preferredCountries: z.array(z.string().min(2).max(10)).optional(),
  preferredFundingTypes: z.array(z.string()).optional(),
  languageProficiencies: z
    .array(
      z.object({
        language: z.string(),
        testName: z.string().optional(),
        score: z.string().optional(),
      })
    )
    .optional(),
  onboardingCompleted: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please provide a valid email address').trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Please provide a valid email address').trim().toLowerCase(),
  otp: z.string().min(4, 'OTP must be at least 4 digits').max(10, 'Invalid OTP length').trim(),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});
