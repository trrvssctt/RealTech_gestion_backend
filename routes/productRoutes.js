import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateStock,
  deleteProduct,
  restoreProduct,
} from '../controllers/productController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { allowCreateProductIfAssigned } from '../middlewares/taskAuth.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validation.js';
import {
  createProductSchema,
  updateProductSchema,
  updateStockSchema,
  productQuerySchema,
  productParamsSchema,
} from '../validators/product.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/products
 * @desc    Get all products with pagination and filters
 * @access  Private
 */
router.get(
  '/',
  validateQuery(productQuerySchema),
  getProducts
);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateParams(productParamsSchema),
  getProductById
);

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  // allow ADMIN/MANAGER as before, but also allow employees assigned to an active 'produit' task
  allowCreateProductIfAssigned,
  validateBody(createProductSchema),
  createProduct
);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  authorize(['ADMIN', 'MANAGER']),
  validateParams(productParamsSchema),
  validateBody(updateProductSchema),
  updateProduct
);

/**
 * @route   PUT /api/products/:id/stock
 * @desc    Update product stock
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/stock',
  authorize(['ADMIN', 'MANAGER']),
  validateParams(productParamsSchema),
  validateBody(updateStockSchema),
  updateStock
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product (soft delete)
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authorize(['ADMIN']),
  validateParams(productParamsSchema),
  deleteProduct
);

/**
 * @route   PUT /api/products/:id/restore
 * @desc    Restore soft-deleted product
 * @access  Private (Admin)
 */
router.put(
  '/:id/restore',
  authorize(['ADMIN']),
  validateParams(productParamsSchema),
  restoreProduct
);

export default router;