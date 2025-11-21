/**
 * Get employee activity stats
 */
export const getEmployeeStats = asyncHandler(async (req, res) => {
  const stats = await UserModel.getEmployeeStats();
  res.json({ success: true, data: stats });
});
import { asyncHandler, ApiError } from '../middlewares/errorHandler.js';
import { hashPassword } from '../utils/hash.js';
import UserModel from '../models/userModel.js';

/**
 * Get all users with pagination and filters
 */
export const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role, actif, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  // If caller is EMPLOYE, restrict results to employees only (and active by default)
  const callerRole = String(req.user?.role || '').toUpperCase();
  const effectiveRoleFilter = callerRole === 'EMPLOYE' ? 'EMPLOYE' : role;
  const effectiveActif = callerRole === 'EMPLOYE' && typeof actif === 'undefined' ? true : actif;

  const opts = { page: Number(page), limit: Number(limit), search, role: effectiveRoleFilter, actif: effectiveActif, sortBy, sortOrder: sortOrder.toUpperCase() };
  const { users, total } = await UserModel.getUsers(opts);
  res.json({ success: true, data: { users, pagination: { total, page: Number(page), pageSize: Number(limit) } } });
});

/**
 * Get user by id with relations
 */
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await UserModel.getUserWithRelations(Number(id));
  if (!user) throw new ApiError(404, 'Utilisateur non trouvé');
  res.json({ success: true, data: { user } });
});

/**
 * Create user
 */
export const createUser = asyncHandler(async (req, res) => {
  const { nom, prenom, email, telephone, password, role } = req.body;

  // Check if user already exists
  const existingUser = await UserModel.getUserByEmail(email);
  if (existingUser) throw new ApiError(409, 'Un utilisateur avec cet email existe déjà');

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await UserModel.createUser({ email, password: hashedPassword, nom, prenom, telephone, role });

  res.status(201).json({ success: true, data: { user }, message: 'Utilisateur créé avec succès' });
});

/**
 * Update user
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email, ...updateData } = req.body;

  const existingUser = await UserModel.getUserById(Number(id));
  if (!existingUser) throw new ApiError(404, 'Utilisateur non trouvé');

  if (email && email !== existingUser.email) {
    const emailExists = await UserModel.getUserByEmail(email);
    if (emailExists) throw new ApiError(409, 'Un utilisateur avec cet email existe déjà');
  }

  const toUpdate = { ...updateData, ...(email && { email }) };
  const user = await UserModel.updateUser(Number(id), toUpdate);
  res.json({ success: true, data: { user }, message: 'Utilisateur mis à jour avec succès' });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existingUser = await UserModel.getUserById(Number(id));
  if (!existingUser) throw new ApiError(404, 'Utilisateur non trouvé');

  await UserModel.deactivateUser(Number(id));
  res.json({ success: true, message: 'Utilisateur désactivé avec succès' });
});

export const reactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existingUser = await UserModel.getUserById(Number(id));
  if (!existingUser) throw new ApiError(404, 'Utilisateur non trouvé');

  await UserModel.reactivateUser(Number(id));
  res.json({ success: true, message: 'Utilisateur réactivé avec succès' });
});