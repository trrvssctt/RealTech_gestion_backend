import { z } from 'zod';

export const commandeItemSchema = z.object({
  id: z.number().positive(),
  quantite: z.number().positive('La quantité doit être positive'),
});

export const createCommandeSchema = z.object({
  clientId: z.number().positive('ID client invalide').optional(),
  produits: z.array(commandeItemSchema).optional().default([]),
  services: z.array(commandeItemSchema).optional().default([]),
});

export const updateCommandeSchema = z.object({
  clientId: z.number().positive('ID client invalide').optional(),
  statut: z.enum(['EN_ATTENTE', 'CONFIRMEE', 'EN_PREPARATION', 'PRETE', 'LIVREE', 'ANNULEE']).optional(),
  total_cmd: z.number().nonnegative().optional(),
  montant_total: z.number().nonnegative().optional(),
});

export const addItemsToCommandeSchema = z.object({
  produits: z.array(commandeItemSchema).optional().default([]),
  services: z.array(commandeItemSchema).optional().default([]),
});

export const removeItemFromCommandeSchema = z.object({
  type: z.enum(['PRODUIT', 'SERVICE']),
  itemId: z.number().positive(),
});

export const commandeQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  statut: z.enum(['EN_ATTENTE', 'CONFIRMEE', 'EN_PREPARATION', 'PRETE', 'LIVREE', 'ANNULEE']).optional(),
  clientId: z.coerce.number().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  sortBy: z.enum(['numero', 'total_cmd', 'statut', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const commandeParamsSchema = z.object({
  id: z.coerce.number().positive('ID commande invalide'),
});

/*

export type CommandeItem = z.infer<typeof commandeItemSchema>;
export type CreateCommandeData = z.infer<typeof createCommandeSchema>;
export type UpdateCommandeData = z.infer<typeof updateCommandeSchema>;
export type AddItemsData = z.infer<typeof addItemsToCommandeSchema>;
export type RemoveItemData = z.infer<typeof removeItemFromCommandeSchema>;
export type CommandeQueryParams = z.infer<typeof commandeQuerySchema>;
export type CommandeParams = z.infer<typeof commandeParamsSchema>;

*/