import { verifyAccessToken, extractTokenFromHeader } from '../config/jwt.js';
import { ApiError } from './errorHandler.js';
import pool from '../config/pg.js';

/**
 * Middleware to authenticate JWT token
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) return next(new ApiError(401, "Token d'authentification requis"));

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      // log minimal info for debugging
      console.warn('JWT verification failed:', err.message);
      return next(new ApiError(401, 'Token invalide'));
    }

    if (!payload || !payload.userId) return next(new ApiError(401, 'Token invalide'));

    // fetch user from DB
    const { rows } = await pool.query(
      'SELECT id, email, role FROM utilisateur WHERE id = $1 AND actif = true',
      [payload.userId]
    );
    const user = rows[0];

    if (!user) return next(new ApiError(401, 'Utilisateur non trouvé ou désactivé'));

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    console.error('Authentication error:', error);
    return next(new ApiError(401, 'Token invalide'));
  }
};

export const authMiddleware = authenticate;

/**
 * Middleware to check user role
 */
export const authorize = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles.map(r => String(r).toUpperCase()) : (allowedRoles ? [String(allowedRoles).toUpperCase()] : []);
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentification requise'));
    if (roles.length === 0) return next();
    const userRole = String(req.user.role || '').toUpperCase();
    if (!roles.includes(userRole)) return next(new ApiError(403, 'Permissions insuffisantes'));
    return next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) return next();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      return next();
    }
    if (!payload || !payload.userId) return next();

    const { rows } = await pool.query(
      'SELECT id, email, role FROM utilisateur WHERE id = $1 AND actif = true',
      [payload.userId]
    );
    const user = rows[0];
    if (user) {
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };
    }
    return next();
  } catch (err) {
    return next();
  }
};