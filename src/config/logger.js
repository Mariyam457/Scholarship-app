import winston from 'winston';
import { env } from './env.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const customPrettyFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `[${timestamp}] ${level}: ${message}${metaStr}${stackStr}`;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    env.LOG_FORMAT === 'json' ? json() : combine(colorize(), customPrettyFormat)
  ),
  defaultMeta: { service: 'scholarpath-backend' },
  transports: [
    new winston.transports.Console(),
  ],
});
