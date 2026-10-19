import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './src/config/env.js';
import { logger } from './src/config/logger.js';
import { connectDatabase, disconnectDatabase } from './src/config/database.js';
import { errorHandler, notFoundHandler } from './src/middleware/error.middleware.js';
import { requestLogger } from './src/middleware/request-logger.middleware.js';
import { apiLimiter } from './src/middleware/rate-limiter.middleware.js';
import apiRouter from './src/routes/index.js';

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for flexible API clients & dashboards
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow mobile apps, curl, Postman (no origin header)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
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

// API v1 root
app.use('/api/v1', apiRouter);

// 404 & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

// Server startup
async function startServer() {
  try {
    await connectDatabase();

    const server = app.listen(env.API_PORT, env.API_HOST, () => {
      logger.info(`🚀 ScholarPath Backend API listening at http://${env.API_HOST}:${env.API_PORT}`);
      logger.info(`🔗 API Health Endpoint: http://localhost:${env.API_PORT}/api/v1/health`);
      logger.info(`✨ Environment: ${env.NODE_ENV}`);
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Gracefully shutting down server...`);
      server.close(async () => {
        await disconnectDatabase();
        logger.info('HTTP server closed. Exiting process.');
        process.exit(0);
      });

      // Force shutdown after 10s if dangling connections
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

// Start if invoked directly
startServer();

export default app;
