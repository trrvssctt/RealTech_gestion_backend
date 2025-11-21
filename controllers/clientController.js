import ClientModel from '../models/clientModel.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * Get all clients with pagination and filters
 */
export const getClients = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    actif,
    sortBy = 'createdat',
    sortOrder = 'desc'
  } = req.query;

  const result = await ClientModel.getClients({
    page: Number(page),
    limit: Number(limit),
    search,
    actif,
    sortBy,
    sortOrder,
  });

  res.json({
    success: true,
    data: {
      clients: result.clients,
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
 * Get client by ID
 */
export const getClientById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await ClientModel.getClientById(Number(id));
  if (!client) {
    throw new ApiError(404, 'Client non trouvé');
  }

  res.json({
    success: true,
    data: { client },
  });
});

/**
 * Create new client
 */
export const createClient = asyncHandler(async (req, res) => {
  const clientData = req.body;

  const client = await ClientModel.createClient(clientData);

  res.status(201).json({
    success: true,
    data: { client },
    message: 'Client créé avec succès',
  });
});

/**
 * Update client
 */
export const updateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const existingClient = await ClientModel.getClientById(Number(id));
  if (!existingClient) {
    throw new ApiError(404, 'Client non trouvé');
  }

  const client = await ClientModel.updateClient(Number(id), updateData);

  res.json({
    success: true,
    data: { client },
    message: 'Client mis à jour avec succès',
  });
});

/**
 * Delete client (soft delete)
 */
export const deleteClient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await ClientModel.getClientById(Number(id));
  if (!client) {
    throw new ApiError(404, 'Client non trouvé');
  }

  await ClientModel.softDeleteClient(Number(id));

  res.json({
    success: true,
    message: 'Client supprimé avec succès',
  });
});

/**
 * Restore soft-deleted client
 */
export const restoreClient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await ClientModel.getClientById(Number(id));
  if (!client) {
    throw new ApiError(404, 'Client non trouvé');
  }
  if (!client.deletedat) {
    throw new ApiError(400, 'Client déjà actif');
  }

  await ClientModel.restoreClient(Number(id));

  res.json({
    success: true,
    message: 'Client restauré avec succès',
  });
});

export const reactivateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await ClientModel.getClientById(Number(id));
  if (!client) {
    throw new ApiError(404, 'Client non trouvé');
  }
  if (client.actif) {
    throw new ApiError(400, 'Client déjà actif');
  }

  const updatedClient = await ClientModel.updateClient(Number(id), { actif: true });

  res.json({
    success: true,
    data: { client: updatedClient },
    message: 'Client réactivé avec succès',
  });
});