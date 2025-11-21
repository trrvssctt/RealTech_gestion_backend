import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

/**
 * General API rate limiting
 */
export const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    error: {
      message: 'Trop de requêtes, veuillez réessayer plus tard.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiting for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 attempts per IP per window
  message: {
    success: false,
    error: {
      message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Rate limiting for password reset endpoints
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Maximum 3 password reset attempts per hour
  message: {
    success: false,
    error: {
      message: 'Trop de demandes de réinitialisation, veuillez réessayer dans 1 heure.',
    },
  },
});