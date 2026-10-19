import { Router } from 'express';
import {
  listQueue,
  getQueueItem,
  approveChange,
  rejectChange,
} from '../controllers/review.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '../constants/enums.js';

const router = Router();

router.use(authenticate, requireRole(UserRole.ADMIN));

router.get('/', listQueue);
router.get('/:id', getQueueItem);
router.post('/:id/approve', approveChange);
router.post('/:id/reject', rejectChange);

export default router;
