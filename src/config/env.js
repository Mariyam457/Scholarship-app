import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend or root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(process.env.PORT ? Number(process.env.PORT) : 5000),
  API_HOST: z.string().default('0.0.0.0'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/scholarpath'),
  MONGODB_DB_NAME: z.string().default('scholarpath'),
  JWT_SECRET: z.string().min(16).default('super_secret_scholarpath_jwt_signing_key_32_chars_min!'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  PASSWORD_SALT_ROUNDS: z.coerce.number().default(12),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().default('scholar@email.com'),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).default('scholar1234'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000,http://localhost:8081,http://127.0.0.1:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(500),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(50),
  WORKER_ENABLED: z.string().transform((v) => v === 'true').default('true'),
  WORKER_CONCURRENCY: z.coerce.number().default(2),
  SOURCE_CHECK_INTERVAL_MINUTES: z.coerce.number().default(1440),
  SOURCE_REQUEST_TIMEOUT_MS: z.coerce.number().default(30000),
  SOURCE_MAX_RESPONSE_SIZE_BYTES: z.coerce.number().default(10485760),
  USER_AGENT: z.string().default('ScholarPath-Bot/1.0 (+https://scholarpath.internal/bot; verification-research@scholarpath.internal)'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('debug'),
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().transform((v) => v === 'true').default('false'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('ScholarBeacon <no-reply@scholarbeacon.org>'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Environment validation failed:', parsed.error.format());
  throw new Error('Environment configuration error');
}

export const env = parsed.data;
