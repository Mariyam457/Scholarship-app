import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  getProfile,
  updateProfile,
  toggleSaveScholarship,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rate-limiter.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/refresh-token', validateBody(refreshTokenSchema), refreshToken);

router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, validateBody(updateProfileSchema), updateProfile);
router.post('/saved/:scholarshipId', authenticate, toggleSaveScholarship);

export default router;
