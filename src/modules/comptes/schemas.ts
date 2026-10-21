import { z } from "zod";
import { routing } from "@/i18n/routing";

export const DUREE_CODE_MS = 10 * 60 * 1000;

export const langueSchema = z.enum(routing.locales);

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const demandeCodeSchema = z.object({
  email: emailSchema,
  langue: langueSchema,
});

export const verificationCodeSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^[0-9]{6}$/),
  langue: langueSchema,
  retour: z.string().max(512).optional(),
  // Moment (ms) où Supabase a confirmé l'envoi du code : sert seulement à choisir « expiré » plutôt que « faux ».
  envoyeLe: z.number().int().positive().optional(),
});

// L'âge arrive en texte : une saisie vide ne doit jamais valoir 0. Entier de 0 à 120 ;
// le refus sous 13 ans est celui de la fonction SQL declarer_age.
export const ageSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{1,3}$/)
  .transform(Number)
  .pipe(z.number().int().min(0).max(120));

export const declarationAgeSchema = z.object({
  age: ageSchema,
  langue: langueSchema,
  retour: z.string().max(512).optional(),
});

export type DemandeCode = z.input<typeof demandeCodeSchema>;
export type VerificationCode = z.input<typeof verificationCodeSchema>;
export type DeclarationAge = z.input<typeof declarationAgeSchema>;
