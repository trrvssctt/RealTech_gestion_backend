// src/utils/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
};

// Add to app.ts: app.use(errorHandler);