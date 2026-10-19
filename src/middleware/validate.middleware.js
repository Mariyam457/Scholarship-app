import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error.js';

export function validateBody(schema) {
  return async (req, _res, next) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(ApiError.badRequest('Validation failed on request body', issues));
      }
      next(error);
    }
  };
}

export function validateQuery(schema) {
  return async (req, _res, next) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(ApiError.badRequest('Validation failed on query parameters', issues));
      }
      next(error);
    }
  };
}

export function validateParams(schema) {
  return async (req, _res, next) => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(ApiError.badRequest('Validation failed on route parameters', issues));
      }
      next(error);
    }
  };
}
