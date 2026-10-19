export class ApiError extends Error {
  constructor(statusCode, message, details = undefined, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details = undefined) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized access', details = undefined) {
    return new ApiError(401, message, details);
  }

  static forbidden(message = 'Forbidden: Access denied', details = undefined) {
    return new ApiError(403, message, details);
  }

  static notFound(message = 'Resource not found', details = undefined) {
    return new ApiError(404, message, details);
  }

  static conflict(message = 'Resource conflict or already exists', details = undefined) {
    return new ApiError(409, message, details);
  }

  static unprocessable(message = 'Unprocessable entity', details = undefined) {
    return new ApiError(422, message, details);
  }

  static internal(message = 'Internal server error', details = undefined) {
    return new ApiError(500, message, details, false);
  }
}
