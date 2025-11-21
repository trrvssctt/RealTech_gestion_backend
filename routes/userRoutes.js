
import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  reactivateUser,
  getEmployeeStats,
} from '../controllers/useurController.js';
import { authenticate, authorize } from '../src/middlewares/auth.js';
import { validateBody, validateQuery, validateParams } from '../src/middlewares/validation.js';
import {
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
  userParamsSchema,
} from '../validators/user.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/users/stats
 * @desc    Get employee activity stats
 * @access  Private (Admin)
 */
router.get('/stats', authorize(['ADMIN']), getEmployeeStats);

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filters
 * @access  Private (Admin, Manager)
 */
router.get(
  '/',
  // Allow any authenticated user to request users; controller will limit results for EMPLOYE
  validateQuery(userQuerySchema),
  getUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin, Manager, or own profile)
 */
router.get(
  '/:id',
  validateParams(userParamsSchema),
  getUserById
);

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (Admin only)
 */
router.post(
  '/',
  authorize(['ADMIN']),
  validateBody(createUserSchema),
  createUser
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin only)
 */
router.put(
  '/:id',
  authorize(['ADMIN']),
  validateParams(userParamsSchema),
  validateBody(updateUserSchema),
  updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete)
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authorize(['ADMIN']),
  validateParams(userParamsSchema),
  deleteUser
);

/**
 * @route   PUT /api/users/:id/reactivate
 * @desc    Reactivate deactivated user
 * @access  Private (Admin only)
 */
router.put(
  '/:id/reactivate',
  authorize(['ADMIN']),
  validateParams(userParamsSchema),
  reactivateUser
);

export default router;
