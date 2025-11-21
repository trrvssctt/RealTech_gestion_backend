import { z } from 'zod';

export const createServiceSchema = z.object({
  nom: z.string().min(2, 'Nom doit contenir au moins 2 caractères'),
  description: z.string().optional(),
  prix_unitaire: z.number().positive('Prix unitaire doit être positif'),
});

export const updateServiceSchema = z.object({
  nom: z.string().min(2, 'Nom doit contenir au moins 2 caractères').optional(),
  description: z.string().optional(),
  prix_unitaire: z.number().positive('Prix unitaire doit être positif').optional(),
  actif: z.boolean().optional(),
});

export const serviceQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  actif: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  sortBy: z.enum(['nom', 'prix_unitaire', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const serviceParamsSchema = z.object({
  id: z.coerce.number().positive('ID service invalide'),
});

/*

export type CreateServiceData = z.infer<typeof createServiceSchema>;
export type UpdateServiceData = z.infer<typeof updateServiceSchema>;
export type ServiceQueryParams = z.infer<typeof serviceQuerySchema>;
export type ServiceParams = z.infer<typeof serviceParamsSchema>;

*/