import express from 'express';
import { listNotifications, markNotificationRead } from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', authenticate, listNotifications);
router.post('/:id/read', authenticate, markNotificationRead);

export default router;
