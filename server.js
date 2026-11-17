import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './src/config/env.js';
import { logger } from './src/config/logger.js';
import { connectDatabase, disconnectDatabase } from './src/config/database.js';
import { errorHandler, notFoundHandler } from './src/middleware/error.middleware.js';
import { requestLogger } from './src/middleware/request-logger.middleware.js';
import { apiLimiter } from './src/middleware/rate-limiter.middleware.js';
import { startMonitorScheduler, stopMonitorScheduler } from './src/worker/monitor-scheduler.js';
import apiRouter from './src/routes/index.js';

const app = express();

// Enable reverse proxy trust for cloud platforms (Vercel, Render, Railway, Cloudflare)
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging & Rate Limiting
app.use(requestLogger);
app.use('/api', apiLimiter);

// Ensure MongoDB connection is established on serverless cold starts (Vercel)
app.use(async (_req, _res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDatabase();
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Root & Top-Level Health Check (for Vercel root URL visits)
app.get(['/', '/health'], (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    success: dbReady,
    service: 'ScholarBeacon API',
    status: dbReady ? 'healthy' : 'degraded',
    database: dbReady ? 'connected' : 'disconnected',
    apiBase: '/api/v1',
    timestamp: new Date().toISOString(),
  });
});

// API v1 root
app.use('/api/v1', apiRouter);

// 404 & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

// Standalone server startup (skipped when imported by Vercel serverless runtime)
async function startServer() {
  try {
    await connectDatabase();

    const server = app.listen(env.API_PORT, env.API_HOST, () => {
      logger.info(`🚀 ScholarPath Backend API listening at http://${env.API_HOST}:${env.API_PORT}`);
      logger.info(`🔗 API Health Endpoint: http://localhost:${env.API_PORT}/api/v1/health`);
      logger.info(`✨ Environment: ${env.NODE_ENV}`);
    });

    if (env.WORKER_ENABLED) {
      startMonitorScheduler({ runImmediately: false });
    }

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Gracefully shutting down server...`);
      stopMonitorScheduler();
      server.close(async () => {
        await disconnectDatabase();
        logger.info('HTTP server closed. Exiting process.');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Force shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
