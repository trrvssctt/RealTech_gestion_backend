// src/middlewares/logMiddleware.ts (for action history)
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';

export const logAction = async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req;
  if (user) {
    try {
      await prisma.log.create({
        data: {
          utilisateurId: user.userId,
          action: `${req.method} ${req.path}`,
          details: JSON.stringify(req.body),
        },
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }
  next();
};

// Add to app.ts: app.use(logAction); after auth if needed