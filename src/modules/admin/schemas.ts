import { z } from "zod";

export const CLES_REGLAGE = [
  "nom_site",
  "numero_whatsapp",
  "forfait_livraison_goma_cents",
  "forfait_livraison_bukavu_cents",
  "retrait_goma_fr",
  "retrait_goma_en",
  "plafond_fabrication",
] as const;

export const cleReglageSchema = z.enum(CLES_REGLAGE);

// Nom du site : 1 à 60 caractères, jamais vide.
export const nomSiteSchema = z.string().trim().min(1).max(60);

// Numéro WhatsApp : format international « + » puis 8 à 15 chiffres, espaces retirés ; vide = effacé (null).
export const numeroWhatsappSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.union([z.literal("").transform(() => null), z.string().regex(/^\+[0-9]{8,15}$/)]));

// Lieu de retrait à Goma : 1 à 500 caractères ; vide = effacé (null).
export const retraitSchema = z.string().transform((v) => v.trim()).pipe(z.union([z.literal("").transform(() => null), z.string().min(1).max(500)]));

// Plafond de fabrication : entier de 1 à 10 000 pièces, chiffres seulement ; vide = effacé (null). Renvoie le texte du nombre.
export const plafondSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.union([z.literal("").transform(() => null), z.string().regex(/^[0-9]{1,5}$/).transform(Number).pipe(z.number().int().min(1).max(10_000)).transform(String)]));

export const entreeReglageSchema = z.object({
  cle: cleReglageSchema,
  // Large : la limite propre à chaque clé (retrait 500, nom 60…) est vérifiée ensuite et donne une erreur de champ.
  valeur: z.string().max(2000),
});

export type EntreeReglage = z.input<typeof entreeReglageSchema>;

export const idMessageSchema = z.uuid();

// Correction d'âge (service seulement, aucun écran au lancement).
export const correctionAgeSchema = z.object({
  compteId: z.uuid(),
  age: z.number().int().min(0).max(120),
  raison: z.string().trim().min(3).max(500),
});

export type CorrectionAge = z.input<typeof correctionAgeSchema>;
