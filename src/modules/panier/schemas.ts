import { z } from "zod";
import { COULEUR_MAX, TAILLES } from "@/modules/catalogue/types";

// Nombre d'exemplaires d'une ligne de produit physique : 1 à 10 (même borne que la base).
export const NOMBRE_MAX_LIGNE = 10;

const nombreSchema = z.number().int().min(1).max(NOMBRE_MAX_LIGNE);

// Produit physique : taille obligatoire (Autre article : « unique », ou absente). Vêtement en couleurs : couleur obligatoire (nom français,
// contrôlé par la base). Kit payant : ni taille, ni couleur, ni nombre.
export const ajoutSchema = z.object({
  produitId: z.uuid(),
  taille: z.enum(TAILLES).nullish(),
  couleur: z.string().trim().min(1).max(COULEUR_MAX).nullish(),
  nombre: nombreSchema.default(1),
});

export const modificationSchema = z.object({ ligneId: z.uuid(), nombre: nombreSchema });
export const retraitSchema = z.object({ ligneId: z.uuid() });

export type EntreeAjout = z.input<typeof ajoutSchema>;
