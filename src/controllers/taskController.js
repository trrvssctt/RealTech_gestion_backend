import TaskModel from '../models/taskModel.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * Get all tasks with pagination and filters
 */
export const getTasks = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    statut,
    priorite,
    utilisateur_id,
    sortBy = 'createdat',
    sortOrder = 'desc'
  } = req.query;

  const result = await TaskModel.getTasks({
    page: Number(page),
    limit: Number(limit),
    search,
    statut,
    priorite,
    utilisateur_id,
    sortBy,
    sortOrder,
  });

  res.json({
    success: true,
    data: {
      tasks: result.tasks,
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
 * Get task by ID
 */
export const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const task = await TaskModel.getTaskById(Number(id));
  if (!task) {
    throw new ApiError(404, 'Tâche non trouvée');
  }

  res.json({
    success: true,
    data: { task },
  });
});

/**
 * Create new task
 */
export const createTask = asyncHandler(async (req, res) => {
  const taskData = req.body;

  // Ensure a non-null utilisateurid is present if the DB requires it.
  // Prefer the first assignee if provided, otherwise default to the current user.
  const userId = req.user?.userId;
  if (!taskData.utilisateurid) {
    if (Array.isArray(taskData.assigneIds) && taskData.assigneIds.length > 0) {
      const uid = Number(taskData.assigneIds[0]);
      taskData.utilisateurid = uid;
      taskData.utilisateur_id = uid;
    } else if (userId) {
      const uid = Number(userId);
      taskData.utilisateurid = uid;
      taskData.utilisateur_id = uid;
    }
  }

  const task = await TaskModel.createTask(taskData);

  // If assigneIds provided, create assignments in pivot table
  if (Array.isArray(taskData.assigneIds) && taskData.assigneIds.length > 0) {
    await TaskModel.assignTaskToUsers(Number(task.id), taskData.assigneIds.map(Number));
  }

  res.status(201).json({
    success: true,
    data: { task },
    message: 'Tâche créée avec succès',
  });
});

/**
 * Update task
 */
export const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const existingTask = await TaskModel.getTaskById(Number(id));
  if (!existingTask) {
    throw new ApiError(404, 'Tâche non trouvée');
  }

  const task = await TaskModel.updateTask(Number(id), updateData);

  res.json({
    success: true,
    data: { task },
    message: 'Tâche mise à jour avec succès',
  });
});

/**
 * Delete task (soft delete)
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const task = await TaskModel.getTaskById(Number(id));
  if (!task) {
    throw new ApiError(404, 'Tâche non trouvée');
  }

  await TaskModel.softDeleteTask(Number(id));

  res.json({
    success: true,
    message: 'Tâche supprimée avec succès',
  });
});

/**
 * Restore soft-deleted task
 */
export const restoreTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const task = await TaskModel.getTaskById(Number(id));
  if (!task) {
    throw new ApiError(404, 'Tâche non trouvée');
  }
  if (!task.deletedat) {
    throw new ApiError(400, 'Tâche déjà active');
  }

  await TaskModel.restoreTask(Number(id));

  res.json({
    success: true,
    message: 'Tâche restaurée avec succès',
  });
});

export const getMyTasks = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Authentification requise');

  const tasks = await TaskModel.getTasksByUserId(userId);

  res.json({
    success: true,
    data: { tasks },
  });
});

export const assignTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { utilisateurIds } = req.body; // array of user ids
  if (!Array.isArray(utilisateurIds)) throw new ApiError(400, 'utilisateurIds must be an array');

  await TaskModel.assignTaskToUsers(Number(id), utilisateurIds.map(Number));

  res.json({ success: true, message: 'Tâche assignée' });
});

export const unassignTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { utilisateurId } = req.body;
  if (!utilisateurId) throw new ApiError(400, 'utilisateurId required');

  await TaskModel.unassignTaskFromUser(Number(id), Number(utilisateurId));
  res.json({ success: true, message: 'Assignment supprimé' });
});

export const completeTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Authentification requise');

  const row = await TaskModel.markAssignmentDone(Number(id), Number(userId));
  if (!row) throw new ApiError(404, 'Assignment non trouvé');

  res.json({ success: true, message: 'Tâche marquée comme terminée' });
});