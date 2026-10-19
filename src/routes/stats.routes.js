import { Router } from 'express';
import { getPlatformStats } from '../controllers/stats.controller.js';

const router = Router();

router.get('/', getPlatformStats);

export default router;
