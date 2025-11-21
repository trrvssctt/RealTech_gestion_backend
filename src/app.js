import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js'; // Ensure this file exists as index.ts
import { connectDatabase } from './config/database.js'; // Ensure this file exists
import { initializeUploadDirectories } from './utils/fileManager.js'; // Ensure this file exists
import { logger } from './utils/logger.js'; // Ensure this file exists
import { apiLimiter } from './middlewares/security.js'; // Ensure this file exists
import { globalErrorHandler, notFound } from './middlewares/errorHandler.js'; // Ensure these files exist
import routes from './routes/index.js'; // Ensure this file exists
import dotenv from 'dotenv';
dotenv.config();

const app = express();

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
// Use configured FRONTEND_URL in production, but keep common dev origins available locally.
const allowedOrigins = [];
if (config.FRONTEND_URL) {
  allowedOrigins.push(config.FRONTEND_URL);
}
if (config.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:8080', 'http://localhost:5173', 'https://smart-ges.vercel.app', 'https://www.realtechprint.com');
}

// Ensure the deployed LWS frontend is allowed (cover the bare domain if needed)
if (config.FRONTEND_URL && !allowedOrigins.includes(config.FRONTEND_URL)) {
  allowedOrigins.push(config.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile clients, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Origin not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
app.use('/api/', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (config.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    next();
  });
}

// Static files for uploads (invoices, receipts)
app.use('/uploads', express.static(config.UPLOAD_PATH));

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(globalErrorHandler);

// Start server
const startServer = async () => {
  try {
    // Initialize directories
    await initializeUploadDirectories();

    // Connect to database
    // Make sure required env vars exist (helpful on platforms like Render)
    if (!config.DATABASE_URL) {
      console.error('FATAL: Missing DATABASE_URL environment variable. Please set it in your environment or Render dashboard.');
      logger && logger.error && logger.error('FATAL: Missing DATABASE_URL environment variable.');
      process.exit(1);
    }
    await connectDatabase();

    // Start listening
    app.listen(config.PORT, () => {
      logger.info(`🚀 RealTech Holding API running on port ${config.PORT}`);
      logger.info(`📊 Dashboard: http://localhost:${config.PORT}/api/health`);
      logger.info(`🔐 Environment: ${config.NODE_ENV}`);

      if (config.NODE_ENV === 'development') {
        logger.info('📋 Available endpoints:');
        logger.info('  - POST /api/auth/login');
        logger.info('  - GET  /api/auth/profile');
        logger.info('  - GET  /api/users');
        logger.info('  - GET  /api/clients');
        logger.info('  - GET  /api/products');
        logger.info('  - GET  /api/services');
        logger.info('  - GET  /api/tasks');
        logger.info('  - GET  /api/commandes');
        logger.info('  - GET  /api/dashboard/stats');
      }
    });
  } catch (error) {
    // Ensure the error is visible in platform logs (Render captures stdout/stderr)
    console.error('❌ Failed to start server:', error && (error.stack || error));
    try {
      logger && logger.error && logger.error('❌ Failed to start server:', error);
    } catch (logErr) {
      console.error('Also failed to write to logger:', logErr);
    }
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  try { logger && logger.error && logger.error('Unhandled Rejection at:', promise, 'reason:', reason); } catch (e) { console.error(e); }
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error && (error.stack || error));
  try { logger && logger.error && logger.error('Uncaught Exception:', error); } catch (e) { console.error(e); }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

startServer();

export default app;