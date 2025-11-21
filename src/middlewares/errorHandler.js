import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';

export class ApiError extends Error {
  constructor(statusCode, message, details = undefined, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Global error handler middleware
 */
export const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error caught by global handler:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // Prisma specific errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        error = new ApiError(409, 'Ressource déjà existante (conflit d\'unicité)');
        break;
      case 'P2025':
        error = new ApiError(404, 'Ressource non trouvée');
        break;
      case 'P2003':
        error = new ApiError(400, 'Violation de contrainte de clé étrangère');
        break;
      default:
        error = new ApiError(500, 'Erreur de base de données');
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    error = new ApiError(400, 'Données de requête invalides');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Token JWT invalide');
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Token JWT expiré');
  }

  // Default to 500 server error
  if (!(error instanceof ApiError)) {
    error = new ApiError(500, 'Erreur interne du serveur');
  }

  res.status(error.statusCode).json({
    success: false,
    error: {
      message: error.message,
      ...(error.details && { details: error.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
};

/**
 * Catch async errors
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle 404 errors
 */
export const notFound = (req, res, next) => {
  const error = new ApiError(404, `Route ${req.originalUrl} non trouvée`);
  next(error);
};