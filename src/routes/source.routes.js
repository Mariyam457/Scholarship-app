import { Router } from 'express';
import {
  listSources,
  getSourceById,
  createSource,
  updateSource,
  testSource,
  triggerCrawl,
} from '../controllers/source.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { createSourceSchema, updateSourceSchema } from '../validators/source.validator.js';
import { UserRole } from '../constants/enums.js';

const router = Router();

// Sources list and details (viewable by authenticated users or admins)
router.get('/', listSources);
router.get('/:id', getSourceById);

// Admin-only management endpoints
router.use(authenticate, requireRole(UserRole.ADMIN));

router.post('/', validateBody(createSourceSchema), createSource);
router.patch('/:id', validateBody(updateSourceSchema), updateSource);
router.post('/test', testSource);
router.post('/:id/crawl', triggerCrawl);

export default router;
