import { v4 as uuidv4 } from 'uuid';

/**
 * Generate unique code for commands, invoices, etc.
 */
export const generateCode = (prefix) => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}-${random}`;
};

/**
 * Generate sequential number for invoices/receipts
 */
export const generateSequentialNumber = (prefix , lastNumber) => {
  const nextNumber = lastNumber + 1;
  return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
};

/**
 * Generate UUID
 */
export const generateUUID = () => {
  return uuidv4();
};

/**
 * Format date for folder structure (YYYY-MM-DD)
 */
export const formatDateForFolder = (date = new Date()) => {
  return date.toISOString().split('T')[0];
};