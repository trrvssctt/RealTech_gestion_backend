import ServiceModel from '../models/serviceModel.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * Get all services with pagination and filters
 */
export const getServices = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    actif,
    minPrice,
    maxPrice,
    sortBy = 'createdat',
    sortOrder = 'desc'
  } = req.query;

  const result = await ServiceModel.getServices({
    page: Number(page),
    limit: Number(limit),
    search,
    actif,
    minPrice,
    maxPrice,
    sortBy,
    sortOrder,
  });

  res.json({
    success: true,
    data: {
      services: result.services,
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
 * Get service by ID
 */
export const getServiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const service = await ServiceModel.getServiceById(Number(id));
  if (!service) {
    throw new ApiError(404, 'Service non trouvé');
  }

  res.json({
    success: true,
    data: { service },
  });
});

/**
 * Create new service
 */
export const createService = asyncHandler(async (req, res) => {
  const serviceData = req.body;

  const service = await ServiceModel.createService(serviceData);

  res.status(201).json({
    success: true,
    data: { service },
    message: 'Service créé avec succès',
  });
});

/**
 * Update service
 */
export const updateService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check if service exists and is not deleted
  const existingService = await ServiceModel.getServiceById(Number(id));
  if (!existingService) {
    throw new ApiError(404, 'Service non trouvé');
  }

  const service = await ServiceModel.updateService(Number(id), updateData);

  res.json({
    success: true,
    data: { service },
    message: 'Service mis à jour avec succès',
  });
});

/**
 * Delete service (soft delete)
 */
export const deleteService = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if service exists and is not deleted
  const service = await ServiceModel.getServiceById(Number(id));
  if (!service) {
    throw new ApiError(404, 'Service non trouvé');
  }

  await ServiceModel.softDeleteService(Number(id));

  res.json({
    success: true,
    message: 'Service supprimé avec succès',
  });
});

/**
 * Restore soft-deleted service
 */
export const restoreService = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const service = await ServiceModel.getServiceById(Number(id));
  if (!service) {
    throw new ApiError(404, 'Service non trouvé');
  }
  if (!service.deletedat) {
    throw new ApiError(400, 'Service déjà actif');
  }

  await ServiceModel.restoreService(Number(id));

  res.json({
    success: true,
    message: 'Service restauré avec succès',
  });
});