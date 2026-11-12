import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import scholarshipRoutes from './scholarship.routes.js';
import applicationRoutes from './application.routes.js';
import sourceRoutes from './source.routes.js';
import reviewRoutes from './review.routes.js';
import statsRoutes from './stats.routes.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'healthy' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    service: 'ScholarBeacon Backend API',
    version: '1.0.0',
  });
});

router.use('/auth', authRoutes);
router.use('/scholarships', scholarshipRoutes);
router.use('/applications', applicationRoutes);
router.use('/sources', sourceRoutes);
router.use('/reviews', reviewRoutes);
router.use('/stats', statsRoutes);

export default router;
