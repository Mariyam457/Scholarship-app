import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDatabase() {
  const options = {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    const maskedUri = env.MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@');
    logger.info(`Connecting to MongoDB at ${maskedUri}...`);
    const conn = await mongoose.connect(env.MONGODB_URI, options);
    logger.info(`✅ MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting reconnect...');
    });

    return conn;
  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed gracefully.');
  } catch (error) {
    logger.error('Error during MongoDB disconnect:', error);
  }
}
