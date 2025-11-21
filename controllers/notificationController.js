import NotificationModel from '../models/notificationModel.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const user = req.user;
  const userId = user?.userId || null;
  const limit = Number(req.query.limit || 10);
  const items = await NotificationModel.listForUser(userId, limit);
  res.json({ success: true, data: { notifications: items } });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await NotificationModel.markAsRead(Number(id));
  res.json({ success: true, data: { notification: updated } });
});
