// src/routes/venteRoutes.ts (updated with all methods)
import express from 'express';
import { createVente, getVentes, getVenteById, updateVente, deleteVente } from '../controllers/venteController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authMiddleware, createVente);
router.get('/', authMiddleware, getVentes);
router.get('/:id', authMiddleware, getVenteById);
router.put('/:id', authMiddleware, updateVente);
router.delete('/:id', authMiddleware, deleteVente);

export default router;