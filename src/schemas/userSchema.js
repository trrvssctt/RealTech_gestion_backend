// src/schemas/userSchema.js
import { z } from 'zod';

export const userRegisterSchema = z.object({
  nom: z.string().min(1, { message: "Le nom est requis" }),
  prenom: z.string().min(1, { message: "Le prénom est requis" }).optional(), // Optional as per Prisma
  email: z.string().email({ message: "Email invalide" }),
  telephone: z.string()
    .regex(/^\d{10}$/, { message: "Numéro de téléphone invalide (10 chiffres)" })
    .optional(), // Optional as per Prisma
  role: z.enum(["admin", "employee"], { message: "Rôle invalide (doit être 'admin' ou 'employee')" }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
});