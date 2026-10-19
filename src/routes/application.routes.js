import { Router } from 'express';
import {
  getUserApplications,
  trackScholarship,
  updateApplication,
  removeApplication,
} from '../controllers/application.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  createApplicationSchema,
  updateApplicationSchema,
} from '../validators/application.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', getUserApplications);
router.post('/', validateBody(createApplicationSchema), trackScholarship);
router.patch('/:id', validateBody(updateApplicationSchema), updateApplication);
router.delete('/:id', removeApplication);

export default router;
