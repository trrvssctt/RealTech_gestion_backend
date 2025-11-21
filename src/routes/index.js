import express from 'express';
import authRoutes from './authRoutes.js';
import clientRoutes from './clientRoutes.js';
import productRoutes from './productRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import commandeRoutes from './commandeRoutes.js';
import venteRoutes from './venteRoutes.js';
import taskRoutes from './taskRoutes.js';
import userRoutes from './userRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'RealTech Holding API is running',
    timestamp: new Date().toISOString(),
  });
});

// routes publiques
router.use('/auth', authRoutes);

// Protection globale pour les routes suivantes
router.use(authenticate);

// routes protégées
router.use('/clients', clientRoutes);
router.use('/produits', productRoutes);
router.use('/services', serviceRoutes);
router.use('/commandes', commandeRoutes);
router.use('/ventes', venteRoutes);
router.use('/tasks', taskRoutes);
// French alias for tasks endpoints (legacy frontend uses /api/taches)
router.use('/taches', taskRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/settings', settingsRoutes);
router.use('/inventaire', inventoryRoutes);
import notificationRoutes from './notificationRoutes.js';
router.use('/notifications', notificationRoutes);

export default router;