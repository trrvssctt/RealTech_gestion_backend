import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, isAbsolute } from 'path';

// Ensure we load the .env file from the project root (realtech-backend/.env)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

export const config = {
  PORT: parseInt(process.env.PORT || '3000'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://gestionapp:Dianka16@postgresql-gestionapp.alwaysdata.net:5432/gestionapp_sidy_application?schema=public',
  
  // JWT
  JWT_SECRET: process.env.JWT_ACCESS_SECRET || 'UgxI/TqA0L/ghdG0IMEl7y/GJAUx1Y0',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'h2e1vvTaFk8kQ3j3KPEL5B1Srdn83Dw',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  
  // File storage - resolve to absolute paths so uploads persist and can be served
  // If an env var is provided, use it; otherwise default to project-root/uploads
  UPLOAD_PATH: (function () {
    const candidate = process.env.UPLOAD_PATH || resolve(__dirname, '..', '..', 'uploads');
    return isAbsolute(candidate) ? candidate : resolve(process.cwd(), candidate);
  })(),
  INVOICES_PATH: (function () {
    const base = process.env.INVOICES_PATH || null;
    if (base) return isAbsolute(base) ? base : resolve(process.cwd(), base);
    return resolve((process.env.UPLOAD_PATH && isAbsolute(process.env.UPLOAD_PATH)) ? process.env.UPLOAD_PATH : resolve(__dirname, '..', '..', 'uploads'), 'Factures');
  })(),
  RECEIPTS_PATH: (function () {
    const base = process.env.RECEIPTS_PATH || null;
    if (base) return isAbsolute(base) ? base : resolve(process.cwd(), base);
    return resolve((process.env.UPLOAD_PATH && isAbsolute(process.env.UPLOAD_PATH)) ? process.env.UPLOAD_PATH : resolve(__dirname, '..', '..', 'uploads'), 'Reçus');
  })(),
  // Frontend URL used for CORS in production (default to your deployed LWS site)
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://www.realtechprint.com',
  
  // Email
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
}; // <-- Correction ici

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL'];


/*for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

*/