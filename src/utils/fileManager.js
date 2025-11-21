import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { formatDateForFolder } from './codeGenenrator.js';

/**
 * Ensure directory exists, create if not
 */
export const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

/**
 * Create folder structure for invoices: Factures/YYYY-MM-DD-num
 */
export const createInvoiceFolder = async (invoiceNumber) => {
  const dateFolder = formatDateForFolder();
  const folderName = `${dateFolder}-${invoiceNumber}`;
  const fullPath = path.join(config.INVOICES_PATH, folderName);
  
  await ensureDirectoryExists(fullPath);
  return fullPath;
};

/**
 * Create folder structure for receipts: Reçus/YYYY-MM-DD-num
 */
export const createReceiptFolder = async (receiptNumber) => {
  const dateFolder = formatDateForFolder();
  const folderName = `${dateFolder}-${receiptNumber}`;
  const fullPath = path.join(config.RECEIPTS_PATH, folderName);
  
  await ensureDirectoryExists(fullPath);
  return fullPath;
};

/**
 * Initialize upload directories
 */
export const initializeUploadDirectories = async () => {
  await ensureDirectoryExists(config.UPLOAD_PATH);
  await ensureDirectoryExists(config.INVOICES_PATH);
  await ensureDirectoryExists(config.RECEIPTS_PATH);
  await ensureDirectoryExists('./logs');
};