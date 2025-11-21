
import { Router } from 'express';
import {
  getCommandes,
  getCommandeById,
  createCommande,
  updateCommande,
  generateInvoice,
  registerPayment,
  getPaiementsForCommande,
  addProduitLine,
  updateProduitLine,
  deleteProduitLine,
  addServiceLine,
  updateServiceLine,
  deleteServiceLine,
  deleteCommande,
  getDeletedCommandes,
} from '../controllers/commandeController.js';
import { authenticate, authorize } from '../src/middlewares/auth.js';
import { validateBody, validateQuery, validateParams } from '../src/middlewares/validation.js';
import {
  createCommandeSchema,
  updateCommandeSchema,
  commandeQuerySchema,
  commandeParamsSchema,
} from '../validators/commande.js';

const router = Router();

// Routes
router.get('/supprimees', getDeletedCommandes);
router.delete('/:id', deleteCommande);

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/commandes
 * @desc    Get all commandes with pagination and filters
 * @access  Private
 */
router.get(
  '/',
  validateQuery(commandeQuerySchema),
  getCommandes
);

/**
 * @route   GET /api/commandes/:id
 * @desc    Get commande by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateParams(commandeParamsSchema),
  getCommandeById
);

/**
 * @route   POST /api/commandes
 * @desc    Create new commande
 * @access  Private
 */
router.post(
  '/',
  validateBody(createCommandeSchema),
  createCommande
);

/**
 * @route   PUT /api/commandes/:id
 * @desc    Update commande
 * @access  Private
 */
router.put(
  '/:id',
  validateParams(commandeParamsSchema),
  validateBody(updateCommandeSchema),
  updateCommande
);

// Produit lines
router.post('/:id/produits', validateParams(commandeParamsSchema), addProduitLine);
router.put('/:id/produits/:itemId', validateParams(commandeParamsSchema), updateProduitLine);
router.delete('/:id/produits/:itemId', validateParams(commandeParamsSchema), deleteProduitLine);

// Service lines
router.post('/:id/services', validateParams(commandeParamsSchema), addServiceLine);
router.put('/:id/services/:itemId', validateParams(commandeParamsSchema), updateServiceLine);
router.delete('/:id/services/:itemId', validateParams(commandeParamsSchema), deleteServiceLine);

// Payments
// keep plural payments route for compatibility
router.post('/:id/payments', validateParams(commandeParamsSchema), registerPayment);
// alias singular route requested by frontend / client
router.post('/:id/paiement', validateParams(commandeParamsSchema), registerPayment);
// list payments for a commande
router.get('/:id/paiements', validateParams(commandeParamsSchema), getPaiementsForCommande);

/**
 * @route   POST /api/commandes/:id/invoice
 * @desc    Generate invoice for commande
 * @access  Private (Admin, Manager)
 */
router.post(
  '/:id/invoice',
  authorize(['ADMIN', 'MANAGER', 'EMPLOYE']),
  validateParams(commandeParamsSchema),
  generateInvoice
);

// Download an existing invoice file (streams the file with proper headers)
router.get(
  '/:id/invoice/download',
  validateParams(commandeParamsSchema),
  // keep it authenticated; allow any authenticated user to download if needed
  (req, res, next) => {
    // lazy-load controller to avoid circular import issues
    import('../controllers/commandeController.js').then(mod => mod.downloadInvoice(req, res, next)).catch(next);
  }
);

// Download receipt (reçu) for a commande (if present)
router.get(
  '/:id/receipt/download',
  validateParams(commandeParamsSchema),
  (req, res, next) => {
    import('../controllers/commandeController.js').then(mod => mod.downloadReceipt(req, res, next)).catch(next);
  }
);

/**
 * @route   DELETE /api/commandes/:id
 * @desc    Delete commande
 * @access  Private (Admin, Manager)
 */
router.delete(
  '/:id',
  authorize(['ADMIN', 'MANAGER']),
  validateParams(commandeParamsSchema),
  deleteCommande
);

export default router;
