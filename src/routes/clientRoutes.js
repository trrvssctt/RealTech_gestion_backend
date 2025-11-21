import { Router } from 'express';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  reactivateClient,
} from '../controllers/clientController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validation.js';
import {
  createClientSchema,
  updateClientSchema,
  clientQuerySchema,
  clientParamsSchema,
} from '../validators/client.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/clients
 * @desc    Get all clients with pagination and filters
 * @access  Private
 */
router.get(
  '/',
  validateQuery(clientQuerySchema),
  getClients
);

/**
 * @route   GET /api/clients/:id
 * @desc    Get client by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateParams(clientParamsSchema),
  getClientById
);

/**
 * @route   POST /api/clients
 * @desc    Create new client
 * @access  Private
 */
router.post(
  '/',
  validateBody(createClientSchema),
  createClient
);

/**
 * @route   PUT /api/clients/:id
 * @desc    Update client
 * @access  Private
 */
router.put(
  '/:id',
  validateParams(clientParamsSchema),
  validateBody(updateClientSchema),
  updateClient
);

/**
 * @route   DELETE /api/clients/:id
 * @desc    Delete client (soft delete)
 * @access  Private (Admin, Manager)
 */
router.delete(
  '/:id',
  authorize(['ADMIN', 'MANAGER']),
  validateParams(clientParamsSchema),
  deleteClient
);

/**
 * @route   PUT /api/clients/:id/reactivate
 * @desc    Reactivate deactivated client
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/reactivate',
  authorize(['ADMIN', 'MANAGER']),
  validateParams(clientParamsSchema),
  reactivateClient
);

export default router;