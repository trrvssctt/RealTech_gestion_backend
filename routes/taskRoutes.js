import { Router } from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getMyTasks,
  assignTask,
  unassignTask,
  completeTask,
} from '../controllers/taskController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validation.js';
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  taskParamsSchema,
  assignTaskSchema,
  unassignTaskSchema,
} from '../validators/task.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/tasks/my
 * @desc    Get current user's tasks
 * @access  Private
 */
router.get('/my', getMyTasks);

// Assign task to users (Admin/Manager)
router.post('/:id/assign', authorize(['ADMIN','MANAGER']), validateParams(taskParamsSchema), validateBody(assignTaskSchema), assignTask);

// Unassign a user from task (Admin/Manager)
router.post('/:id/unassign', authorize(['ADMIN','MANAGER']), validateParams(taskParamsSchema), validateBody(unassignTaskSchema), unassignTask);

// Mark current user's assignment as complete
router.post('/:id/complete', validateParams(taskParamsSchema), completeTask);

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks with pagination and filters
 * @access  Private
 */
router.get(
  '/',
  validateQuery(taskQuerySchema),
  getTasks
);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get task by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateParams(taskParamsSchema),
  getTaskById
);

/**
 * @route   POST /api/tasks
 * @desc    Create new task
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  authorize(['ADMIN', 'MANAGER']),
  validateBody(createTaskSchema),
  createTask
);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update task
 * @access  Private (Admin, Manager, or assigned employee for status only)
 */
router.put(
  '/:id',
  validateParams(taskParamsSchema),
  validateBody(updateTaskSchema),
  updateTask
);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete task
 * @access  Private (Admin, Manager)
 */
router.delete(
  '/:id',
  authorize(['ADMIN', 'MANAGER']),
  validateParams(taskParamsSchema),
  deleteTask
);

export default router;