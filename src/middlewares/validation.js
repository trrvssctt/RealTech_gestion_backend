import { ZodError } from 'zod';
import { ApiError } from './errorHandler.js';

/**
 * Middleware factory for validating request body using Zod schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    // If no schema or schema isn't a Zod schema, skip validation
    if (!schema || typeof schema.safeParse !== 'function') {
      req.validatedBody = req.body;
      return next();
    }

    const result = schema.safeParse(req.body);
    if (!result.success) {
      // build a readable message from Zod issues
      const details = result.error.errors.map(e => {
        const path = e.path.length ? e.path.join('.') : 'body';
        return `${path}: ${e.message}`;
      }).join(' | ');
      return next(new ApiError(400, `Données invalides: ${details}`));
    }
    req.validatedBody = result.data;
    return next();
  };
}

/**
 * Middleware factory for validating query parameters
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    if (!schema || typeof schema.safeParse !== 'function') {
      req.validatedQuery = req.query;
      return next();
    }

    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map(e => {
        const path = e.path.length ? e.path.join('.') : 'query';
        return `${path}: ${e.message}`;
      }).join(' | ');
      return next(new ApiError(400, `Requête invalide: ${details}`));
    }
    req.validatedQuery = result.data;
    return next();
  };
}

/**
 * Middleware factory for validating URL parameters
 */
export function validateParams(schema) {
  return (req, res, next) => {
    if (!schema || typeof schema.safeParse !== 'function') {
      req.validatedParams = req.params;
      return next();
    }

    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = result.error.errors.map(e => {
        const path = e.path.length ? e.path.join('.') : 'params';
        return `${path}: ${e.message}`;
      }).join(' | ');
      return next(new ApiError(400, `Paramètres invalides: ${details}`));
    }
    req.validatedParams = result.data;
    return next();
  };
}