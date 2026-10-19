import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { env } from '../config/env.js';

export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(env.PASSWORD_SALT_ROUNDS);
  return bcrypt.hash(plainPassword, salt);
}

export async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function generateTokens(payload) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 mins in seconds
  };
}

export function hashRefreshToken(refreshToken) {
  return createHash('sha256').update(refreshToken).digest('hex');
}
