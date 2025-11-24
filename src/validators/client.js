import { z } from 'zod';

const optionalNonEmptyString = z.preprocess((v) => {
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? undefined : t;
  }
  return v;
}, z.string().min(1).optional());

export const createClientSchema = z.object({
  nom: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(2, 'Nom doit contenir au moins 2 caractères').optional()),
  prenom: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(2, 'Prénom doit contenir au moins 2 caractères').optional()),
  // Preprocess: empty string => undefined, then allow undefined or valid email
  email: z.preprocess((v) => {
    if (typeof v === 'string') {
      const t = v.trim();
      return t === '' ? undefined : t;
    }
    return v;
  }, z.string().email('Email invalide').optional()),
  // telephone should be required and min length 4
  telephone: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(4, 'Téléphone invalide')),
}).refine(data => Boolean((data.nom && data.nom.trim().length >= 2) || (data.prenom && data.prenom.trim().length >= 2)), {
  message: 'Au moins un nom ou prénom (2 caractères min) est requis',
  path: ['nom', 'prenom'],
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