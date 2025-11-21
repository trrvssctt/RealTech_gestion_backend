import { z } from 'zod';

export const createClientSchema = z.object({
  nom: z.string().min(2, 'Nom doit contenir au moins 2 caractères'),
  prenom: z.string().min(2, 'Prénom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide').optional(),
  telephone: z.string().optional(),
});

export const updateClientSchema = z.object({
  nom: z.string().min(2, 'Nom doit contenir au moins 2 caractères').optional(),
  prenom: z.string().min(2, 'Prénom doit contenir au moins 2 caractères').optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  telephone: z.string().optional(),
  actif: z.boolean().optional(),
});

export const clientQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  actif: z.coerce.boolean().optional(),
  sortBy: z.enum(['nom', 'prenom', 'email', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const clientParamsSchema = z.object({
  id: z.coerce.number().positive('ID client invalide'),
});

/*

export type CreateClientData = z.infer<typeof createClientSchema>;
export type UpdateClientData = z.infer<typeof updateClientSchema>;
export type ClientQueryParams = z.infer<typeof clientQuerySchema>;
export type ClientParams = z.infer<typeof clientParamsSchema>;

*/