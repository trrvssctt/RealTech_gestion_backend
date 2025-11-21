import ProductModel from '../models/productModel.js';
import InventoryModel from '../models/inventoryModel.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * Get all products with pagination and filters
 */
export const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    actif,
    enStock,
    minPrice,
    maxPrice,
    //sortBy = 'actif, createdat',
    sortOrder = 'desc'
  } = req.query;

  const result = await ProductModel.getProducts({
    page: Number(page),
    limit: Number(limit),
    search,
    actif,
    enStock,
    minPrice,
    maxPrice,
    //sortBy,
    sortOrder,
  });

  res.json({
    success: true,
    data: {
      products: result.products,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.total,
        itemsPerPage: Number(limit),
        hasNextPage: result.currentPage < result.totalPages,
        hasPrevPage: result.currentPage > 1,
      },
    },
  });
});

/**
 * Get product by ID
 */
export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await ProductModel.getProductById(Number(id));
  if (!product) {
    throw new ApiError(404, 'Produit non trouvé');
  }

  res.json({
    success: true,
    data: { product },
  });
});

/**
 * Create new product
 */
export const createProduct = asyncHandler(async (req, res) => {
  const productData = req.body;

  const product = await ProductModel.createProduct(productData);

  res.status(201).json({
    success: true,
    data: { product },
    message: 'Produit créé avec succès',
  });
});

/**
 * Update product
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check if product exists and is not deleted
  const existingProduct = await ProductModel.getProductById(Number(id));
  if (!existingProduct) {
    throw new ApiError(404, 'Produit non trouvé');
  }

  const product = await ProductModel.updateProduct(Number(id), updateData);

  res.json({
    success: true,
    data: { product },
    message: 'Produit mis à jour avec succès',
  });
});

/**
 * Update product stock
 */
export const updateStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantite, type } = req.body;

  const product = await ProductModel.updateStock(Number(id), quantite, type);

  if (!product) {
    throw new ApiError(404, 'Produit non trouvé');
  }

  // Record inventory movement for manual adjustments
  try {
    const movementType = type === 'ADD' ? 'IN' : type === 'SUBTRACT' ? 'OUT' : 'IN';
  await InventoryModel.createMovement({ produitid: Number(id), quantite: Number(quantite), type: movementType, source: 'MANUEL', utilisateurid: req.user?.userId || null });
  } catch (err) {
    console.warn('Impossible d enregistrer le mouvement d inventaire:', err.message || err);
  }

  res.json({
    success: true,
    data: { product },
    message: 'Stock mis à jour avec succès',
  });
});

/**
 * Delete product (soft delete)
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await ProductModel.getProductById(Number(id));
  if (!product) {
    throw new ApiError(404, 'Produit non trouvé');
  }

  await ProductModel.softDeleteProduct(Number(id));

  res.json({
    success: true,
    message: 'Produit supprimé avec succès',
  });
});

/**
 * Restore soft-deleted product
 */
export const restoreProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await ProductModel.getProductById(Number(id));
  if (!product) {
    throw new ApiError(404, 'Produit non trouvé');
  }
  if (!product.deletedat) {
    throw new ApiError(400, 'Produit déjà actif');
  }

  await ProductModel.restoreProduct(Number(id));

  res.json({
    success: true,
    message: 'Produit restauré avec succès',
  });
});