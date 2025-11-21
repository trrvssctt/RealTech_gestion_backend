import { z } from 'zod';

export const createProductSchema = z.object({
  nom: z.string().min(2, 'Nom doit contenir au moins 2 caractères'),
  description: z.string().optional(),
  prix_unitaire: z.number().positive('Prix unitaire doit être positif'),
  stock_actuel: z.number().min(0, 'Stock ne peut pas être négatif').default(0),
});

export const updateProductSchema = z.object({
  nom: z.string().min(2, 'Nom doit contenir au moins 2 caractères').optional(),
  description: z.string().optional(),
  prix_unitaire: z.number().positive('Prix unitaire doit être positif').optional(),
  stock_actuel: z.number().min(0, 'Stock ne peut pas être négatif').optional(),
  actif: z.boolean().optional(),
});

export const updateStockSchema = z.object({
  quantite: z.number(),
  type: z.enum(['ADD', 'SUBTRACT', 'SET']),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  actif: z.coerce.boolean().optional(),
  enStock: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  sortBy: z.enum(['nom', 'prix_unitaire', 'stock_actuel', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const productParamsSchema = z.object({
  id: z.coerce.number().positive('ID produit invalide'),
});


/*
export type CreateProductData = z.infer<typeof createProductSchema>;
export type UpdateProductData = z.infer<typeof updateProductSchema>;
export type UpdateStockData = z.infer<typeof updateStockSchema>;
export type ProductQueryParams = z.infer<typeof productQuerySchema>;
export type ProductParams = z.infer<typeof productParamsSchema>;
*/