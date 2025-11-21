import { Router } from 'express';
import {
  getDashboardStats,
  getMonthlySalesChart,
  getTopProducts,
  getRecentActivity,
} from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private - admin sees full view, employees see restricted view (handled in controller)
 */
router.get('/stats', getDashboardStats);

/**
 * @route   GET /api/dashboard/sales-chart
 * @desc    Get monthly sales chart data
 * @access  Private (Admin, Manager)
 */
router.get('/sales-chart', authorize(['ADMIN', 'MANAGER']), getMonthlySalesChart);

/**
 * @route   GET /api/dashboard/top-products
 * @desc    Get top products by sales
 * @access  Private (Admin, Manager)
 */
router.get('/top-products', authorize(['ADMIN', 'MANAGER']), getTopProducts);

/**
 * @route   GET /api/dashboard/recent-activity
 * @desc    Get recent activity
 * @access  Private (any authenticated user)
 */
router.get('/recent-activity', getRecentActivity);

export default router;