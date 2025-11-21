import bcrypt from 'bcrypt';
import { config } from '../config/index.js';

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, config.BCRYPT_ROUNDS);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};