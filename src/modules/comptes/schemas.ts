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

export const demandeGoogleSchema = z.object({
  langue: langueSchema,
  // Un retour trop long n'est pas une erreur : cheminRetourValide le ramène à l'accueil.
  retour: z.string().optional(),
});

// Ce que le serveur garde le temps de la visite chez Google : la langue et le retour déjà validés.
export const retourGoogleSchema = z.object({
  langue: langueSchema,
  retour: z.string().max(512),
});

export type DemandeGoogle = z.input<typeof demandeGoogleSchema>;

export const ORIGINES = ["tiktok", "instagram", "facebook", "youtube", "whatsapp", "google", "ia", "ami", "evenement", "autre"] as const;
export const PREFERENCES_CREATION = ["porter", "fabriquer"] as const;

// Les deux réponses sont facultatives : absente ou vide = pas de réponse. Une valeur hors liste est refusée (rien n'est enregistré).
const reponseFacultative = <T extends readonly [string, ...string[]]>(valeurs: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), z.enum(valeurs).nullable()).optional();

export const questionsAccueilSchema = z.object({
  origine: reponseFacultative(ORIGINES),
  preference: reponseFacultative(PREFERENCES_CREATION),
  // Univers préféré (identifiant) : facultatif ; un identifiant inexistant est refusé par la base (rien n'est enregistré).
  univers: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.uuid().nullable()).optional(),
  langue: langueSchema,
  retour: z.string().max(512).optional(),
});

export type QuestionsAccueil = z.input<typeof questionsAccueilSchema>;
