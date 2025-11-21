import { Router } from 'express';
import { listMovements, createMovement } from '../controllers/inventoryController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody, validateQuery } from '../middlewares/validation.js';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery({}), listMovements);

// Only ADMIN and MANAGER can create manual entries
router.post('/', authorize(['ADMIN', 'MANAGER']), validateBody({}), createMovement);

export default router;
