import { Router } from 'express';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  restoreService,
} from '../controllers/serviceController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { allowCreateServiceIfAssigned } from '../middlewares/taskAuth.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validation.js';
import {
  createServiceSchema,
  updateServiceSchema,
  serviceQuerySchema,
  serviceParamsSchema,
} from '../validators/service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/services
 * @desc    Get all services with pagination and filters
 * @access  Private
 */
router.get(
  '/',
  validateQuery(serviceQuerySchema),
  getServices
);

/**
 * @route   GET /api/services/:id
 * @desc    Get service by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateParams(serviceParamsSchema),
  getServiceById
);

/**
 * @route   POST /api/services
 * @desc    Create new service
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  // allow ADMIN/MANAGER as before, but also allow employees assigned to an active 'service' task
  allowCreateServiceIfAssigned,
  validateBody(createServiceSchema),
  createService
);

/**
 * @route   PUT /api/services/:id
 * @desc    Update service
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  authorize(['ADMIN', 'MANAGER']),
  validateParams(serviceParamsSchema),
  validateBody(updateServiceSchema),
  updateService
);

/**
 * @route   DELETE /api/services/:id
 * @desc    Delete service (soft delete)
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authorize(['ADMIN']),
  validateParams(serviceParamsSchema),
  deleteService
);

/**
 * @route   PUT /api/services/:id/restore
 * @desc    Restore soft-deleted service
 * @access  Private (Admin)
 */
router.put(
  '/:id/restore',
  authorize(['ADMIN']),
  validateParams(serviceParamsSchema),
  restoreService
);

export default router;