import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let cachedConnectionPromise = null;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cachedConnectionPromise) {
    return cachedConnectionPromise;
  }

  if (env.MONGODB_URI.startsWith('mongodb+srv://') && !process.env.VERCEL) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch {
      // fallback to system resolver
    }
  }

  const options = {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };

  const maskedUri = env.MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@');
  logger.info(`Connecting to MongoDB at ${maskedUri}...`);

  cachedConnectionPromise = mongoose
    .connect(env.MONGODB_URI, options)
    .then((conn) => {
      logger.info(`✅ MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);

      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        cachedConnectionPromise = null;
        logger.warn('MongoDB disconnected. Attempting reconnect...');
      });

      return conn;
    })
    .catch((error) => {
      cachedConnectionPromise = null;
      logger.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    });

  return cachedConnectionPromise;
}

export async function disconnectDatabase() {
  try {
    cachedConnectionPromise = null;
    await mongoose.disconnect();
    logger.info('MongoDB connection closed gracefully.');
  } catch (error) {
    logger.error('Error during MongoDB disconnect:', error);
  }
}
