import { Router } from 'express';
import {
  listScholarships,
  getScholarshipById,
  getScholarshipBySlug,
  matchForUser,
  createScholarship,
  updateScholarship,
  deleteScholarship,
} from '../controllers/scholarship.controller.js';
import { authenticate, requireRole, optionalAuth } from '../middleware/auth.middleware.js';
import { validateQuery, validateBody } from '../middleware/validate.middleware.js';
import {
  scholarshipFilterSchema,
  createScholarshipSchema,
  updateScholarshipSchema,
} from '../validators/scholarship.validator.js';
import { UserRole } from '../constants/enums.js';

const router = Router();

// Public routes
router.get('/', validateQuery(scholarshipFilterSchema), listScholarships);
router.get('/slug/:slug', optionalAuth, getScholarshipBySlug);
router.get('/:id', optionalAuth, getScholarshipById);

// Authenticated student routes
router.get('/match/me', authenticate, matchForUser);

// Admin-only routes
router.post('/', authenticate, requireRole(UserRole.ADMIN), validateBody(createScholarshipSchema), createScholarship);
router.patch('/:id', authenticate, requireRole(UserRole.ADMIN), validateBody(updateScholarshipSchema), updateScholarship);
router.delete('/:id', authenticate, requireRole(UserRole.ADMIN), deleteScholarship);

export default router;
