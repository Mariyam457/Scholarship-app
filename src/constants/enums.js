/**
 * Core system enums and constants (Pure JavaScript)
 */

export const DegreeLevel = Object.freeze({
  BACHELORS: 'bachelors',
  MASTERS: 'masters',
  PHD: 'phd',
  POSTDOC: 'postdoc',
  INTERNSHIP: 'internship',
  CERTIFICATE: 'certificate',
  HIGH_SCHOOL: 'high_school',
  OTHER: 'other',
});

export const FundingType = Object.freeze({
  FULL_FUNDING: 'full_funding',
  TUITION_ONLY: 'tuition_only',
  PARTIAL: 'partial',
  STIPEND_ONLY: 'stipend_only',
  GRANT: 'grant',
});

export const ApplicationStatus = Object.freeze({
  SAVED: 'saved',
  IN_PROGRESS: 'in_progress',
  APPLIED: 'applied',
  UNDER_REVIEW: 'under_review',
  INTERVIEW: 'interview',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WAITLISTED: 'waitlisted',
});

export const SourceMethod = Object.freeze({
  CRAWL: 'crawl',
  API: 'api',
  RSS: 'rss',
  PDF: 'pdf',
});

export const AutomationState = Object.freeze({
  ACTIVE: 'active',
  QUARANTINED: 'quarantined',
  DEGRADED: 'degraded',
  MANUAL_ONLY: 'manual_only',
  DRAFT: 'draft',
});

export const VerificationStatus = Object.freeze({
  VERIFIED: 'verified',
  NEEDS_REVIEW: 'needs_review',
  DEPRECATED: 'deprecated',
  DRAFT: 'draft',
});

export const ChangeCategory = Object.freeze({
  DEADLINE_CHANGE: 'deadline_change',
  FUNDING_CHANGE: 'funding_change',
  ELIGIBILITY_CHANGE: 'eligibility_change',
  LINK_BROKEN: 'link_broken',
  NEW_SCHOLARSHIP: 'new_scholarship',
  SCHOLARSHIP_CLOSED: 'scholarship_closed',
  CONTENT_UPDATE: 'content_update',
  MINOR_TEXT: 'minor_text',
});

export const Severity = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
});

export const ReviewStatus = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  AUTO_APPLIED: 'auto_applied',
});

export const UserRole = Object.freeze({
  STUDENT: 'student',
  ADMIN: 'admin',
  AUDITOR: 'auditor',
});

export const GenderRequirement = Object.freeze({
  ALL: 'all',
  FEMALE_ONLY: 'female_only',
  MALE_ONLY: 'male_only',
  NON_BINARY: 'non_binary',
});
