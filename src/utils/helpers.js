// src/utils/helpers.ts
export const generateCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

// getNextNumero: Use Prisma to find max numero +1, or use sequences in DB