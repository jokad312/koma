import { z } from "zod";

// Schéma de l'article écrit par l'Admin : titre FR + texte FR obligatoires, version EN facultative, slug et lien Produit optionnels.
export const schemaArticle = z.object({
  titreFr: z.string().min(1, "titre_invalide").max(120, "titre_invalide"),
  texteFr: z.string().max(5000, "texte_invalide"),
  titreEn: z.string().max(120, "titre_invalide").nullish(),
  texteEn: z.string().max(5000, "texte_invalide").nullish(),
  slug: z.string().max(80, "slug_invalide").nullish(),
  lienProduitId: z.string().nullish(),
  images: z.array(z.object({ fichier: z.string(), altFr: z.string(), altEn: z.string() })).default([]),
});

export type ArticleSchema = z.infer<typeof schemaArticle>;
