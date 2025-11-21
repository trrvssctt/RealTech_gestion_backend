import { Router } from 'express';
import { 
  login, 
  registerUser, 
  refresh, 
  getProfile, 
  changePassword, 
  logout 
} from '../controllers/authController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validation.js';
import { authLimiter } from '../middlewares/security.js';
import { 
  loginSchema, 
  registerSchema, 
  refreshTokenSchema, 
  changePasswordSchema 
} from '../validators/auth.js';
import { userRegisterSchema } from '../schemas/userSchema.js';

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    User login
 * @access  Public
 */
router.post('/login', authLimiter, validateBody(loginSchema), login);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (Admin only)
 * @access  Private (Admin only)
 */
router.post('/register',  validateBody(userRegisterSchema), registerUser);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', validateBody(refreshTokenSchema), refresh);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, getProfile);

/**
 * @route   PUT /api/auth/password
 * @desc    Change password
 * @access  Private
 */
router.put('/password', authenticate, validateBody(changePasswordSchema), changePassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, logout);

export default router;