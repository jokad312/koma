import { z } from "zod";
import { TAILLES } from "@/modules/catalogue/types";

// Nombre d'exemplaires d'une ligne de produit physique : 1 à 10 (même borne que la base).
export const NOMBRE_MAX_LIGNE = 10;

const nombreSchema = z.number().int().min(1).max(NOMBRE_MAX_LIGNE);

// Produit physique : taille obligatoire. Kit payant : pas de taille ni de nombre.
export const ajoutSchema = z.object({
  produitId: z.uuid(),
  taille: z.enum(TAILLES).nullish(),
  nombre: nombreSchema.default(1),
});

export const modificationSchema = z.object({ ligneId: z.uuid(), nombre: nombreSchema });
export const retraitSchema = z.object({ ligneId: z.uuid() });

export type EntreeAjout = z.input<typeof ajoutSchema>;
