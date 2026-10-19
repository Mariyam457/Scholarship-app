import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/api-error.js';
import { UserRole } from '../constants/enums.js';

export async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('Authentication token is required'));
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return next(ApiError.unauthorized('Session expired. Please log in or refresh your token.'));
      }
      return next(ApiError.unauthorized('Invalid authentication token'));
    }

    const user = await UserModel.findById(decoded.userId).select('-passwordHash -refreshTokenHash');
    if (!user) {
      return next(ApiError.unauthorized('Account not found or deleted'));
    }

    if (!user.isActive) {
      return next(ApiError.forbidden('Your account has been deactivated'));
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      userDoc: user,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to access this resource'));
    }
    next();
  };
}

export async function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await UserModel.findById(decoded.userId).select('-passwordHash -refreshTokenHash');
      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          userDoc: user,
        };
      }
    }
  } catch {
    // Silently continue without user
  }
  next();
}
