import { z } from 'zod';

export const createTaskSchema = z.object({
  nom: z.string().min(2, 'Nom doit contenir au moins 2 caractères'),
  description: z.string().optional(),
  date_debut: z.coerce.date(),
  date_fin: z.coerce.date().optional(),
  frequence: z.enum(['UNIQUE', 'QUOTIDIENNE', 'HEBDOMADAIRE', 'MENSUELLE', 'TRIMESTRIELLE', 'ANNUELLE']).default('UNIQUE'),
  importance: z.enum(['BASSE', 'MOYENNE', 'HAUTE', 'CRITIQUE']).default('MOYENNE'),
  // support multiple assignees on create
  assigneIds: z.array(z.number().positive('ID assigné invalide')).optional(),
});

export const updateTaskSchema = z.object({
  nom: z.string().min(2, 'Nom doit contenir au moins 2 caractères').optional(),
  description: z.string().optional(),
  date_debut: z.coerce.date().optional(),
  date_fin: z.coerce.date().optional(),
  frequence: z.enum(['UNIQUE', 'QUOTIDIENNE', 'HEBDOMADAIRE', 'MENSUELLE', 'TRIMESTRIELLE', 'ANNUELLE']).optional(),
  importance: z.enum(['BASSE', 'MOYENNE', 'HAUTE', 'CRITIQUE']).optional(),
  statut: z.enum(['EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'ANNULEE']).optional(),
  assigneId: z.number().positive('ID assigné invalide').optional(),
});

// Schema for assign endpoint: accepts an array of user ids
export const assignTaskSchema = z.object({
  utilisateurIds: z.array(z.number().positive('ID utilisateur invalide')).min(1, 'Au moins un utilisateur requis'),
});

// Schema for unassign endpoint: single utilisateurId
export const unassignTaskSchema = z.object({
  utilisateurId: z.number().positive('ID utilisateur invalide'),
});

export const taskQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  statut: z.enum(['EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'ANNULEE']).optional(),
  importance: z.enum(['BASSE', 'MOYENNE', 'HAUTE', 'CRITIQUE']).optional(),
  frequence: z.enum(['UNIQUE', 'QUOTIDIENNE', 'HEBDOMADAIRE', 'MENSUELLE', 'TRIMESTRIELLE', 'ANNUELLE']).optional(),
  assigneId: z.coerce.number().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['nom', 'date_debut', 'date_fin', 'importance', 'statut', 'createdAt']).default('date_debut'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const taskParamsSchema = z.object({
  id: z.coerce.number().positive('ID tâche invalide'),
});

/*
export type CreateTaskData = z.infer<typeof createTaskSchema>;
export type UpdateTaskData = z.infer<typeof updateTaskSchema>;
export type TaskQueryParams = z.infer<typeof taskQuerySchema>;
export type TaskParams = z.infer<typeof taskParamsSchema>;

*/