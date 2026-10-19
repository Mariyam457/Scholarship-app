import { ApiError } from '../utils/api-error.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  let error = err;

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = ApiError.conflict(`An entry with this ${field} already exists.`);
  }

  // Handle Mongoose CastError (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid format for parameter: ${err.path}`);
  }

  // Handle JsonWebTokenError
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid security token.');
  }

  // Handle TokenExpiredError
  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Security token has expired. Please refresh.');
  }

  // Fallback to 500 if not an ApiError instance
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, undefined, false);
  }

  // Log error
  if (error.statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} - ${error.message}`, {
      stack: err.stack,
      body: req.body,
      query: req.query,
      params: req.params,
    });
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} - ${error.statusCode} ${error.message}`);
  }

  const responsePayload = {
    success: false,
    error: {
      code:
        error.statusCode === 400
          ? 'BAD_REQUEST'
          : error.statusCode === 401
          ? 'UNAUTHORIZED'
          : error.statusCode === 403
          ? 'FORBIDDEN'
          : error.statusCode === 404
          ? 'NOT_FOUND'
          : error.statusCode === 409
          ? 'CONFLICT'
          : error.statusCode === 422
          ? 'UNPROCESSABLE'
          : 'INTERNAL_ERROR',
      message: error.message,
    },
  };

  if (error.details) {
    responsePayload.error.details = error.details;
  }

  if (env.NODE_ENV === 'development' && err.stack) {
    responsePayload.error.stack = err.stack;
  }

  res.status(error.statusCode).json(responsePayload);
}

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
