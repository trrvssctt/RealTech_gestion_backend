import { z } from 'zod';

export const createUserSchema = z.object({
  nom: z.string().min(2, 'Nom doit contenir au moins 2 caractères'),
  prenom: z.string().min(2, 'Prénom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  telephone: z.string().optional(),
  password: z.string()
    .min(8, 'Mot de passe doit contenir au moins 8 caractères')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYE']).default('EMPLOYE'),
});

export const updateUserSchema = z.object({
  nom: z.string().min(2, 'Nom doit contenir au moins 2 caractères').optional(),
  prenom: z.string().min(2, 'Prénom doit contenir au moins 2 caractères').optional(),
  email: z.string().email('Email invalide').optional(),
  telephone: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYE']).optional(),
  actif: z.boolean().optional(),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYE']).optional(),
  actif: z.coerce.boolean().optional(),
  sortBy: z.enum(['nom', 'prenom', 'email', 'role', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const userParamsSchema = z.object({
  id: z.coerce.number().positive('ID utilisateur invalide'),
});

/*
export type CreateUserData = z.infer<typeof createUserSchema>;
export type UpdateUserData = z.infer<typeof updateUserSchema>;
export type UserQueryParams = z.infer<typeof userQuerySchema>;
export type UserParams = z.infer<typeof userParamsSchema>;

*/