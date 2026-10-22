import { z } from "zod";

export const CLES_REGLAGE = ["nom_site", "numero_whatsapp"] as const;

export const cleReglageSchema = z.enum(CLES_REGLAGE);

// Nom du site : 1 à 60 caractères, jamais vide.
export const nomSiteSchema = z.string().trim().min(1).max(60);

// Numéro WhatsApp : format international « + » puis 8 à 15 chiffres, espaces retirés ; vide = effacé (null).
export const numeroWhatsappSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.union([z.literal("").transform(() => null), z.string().regex(/^\+[0-9]{8,15}$/)]));

export const entreeReglageSchema = z.object({
  cle: cleReglageSchema,
  valeur: z.string().max(200),
});

export type EntreeReglage = z.input<typeof entreeReglageSchema>;

// Correction d'âge (service seulement, aucun écran au lancement).
export const correctionAgeSchema = z.object({
  compteId: z.uuid(),
  age: z.number().int().min(0).max(120),
  raison: z.string().trim().min(3).max(500),
});

export type CorrectionAge = z.input<typeof correctionAgeSchema>;
