import { z } from "zod";
import { CHEMIN_IMAGE_ARTICLE, type CodeErreurBlog } from "./types";

// Une image d'article vient du circuit d'envoi : chemin public contrôlé, textes alternatifs FR et EN obligatoires.
const imageSchema = z.object({
  fichier: z.string().regex(CHEMIN_IMAGE_ARTICLE, "article_invalide"),
  altFr: z.string().trim().min(1, "alt_invalide").max(200, "alt_invalide"),
  altEn: z.string().trim().min(1, "alt_invalide").max(200, "alt_invalide"),
});

// Une saisie vide vaut « pas de valeur » : jamais une chaîne vide là où la base attend NULL.
const videEnNull = (valeur: unknown) => (typeof valeur === "string" && valeur.trim() === "" ? null : valeur);

// Schéma de l'article écrit par l'Admin : titre FR obligatoire, texte FR facultatif tant que l'article est un brouillon,
// version EN facultative, slug et lien Produit optionnels. L'adresse suit exactement la forme acceptée par la base.
export const schemaArticle = z.object({
  titreFr: z.string().trim().min(1, "titre_invalide").max(120, "titre_invalide"),
  texteFr: z.string().max(5000, "texte_invalide"),
  titreEn: z.preprocess(videEnNull, z.string().trim().max(120, "titre_invalide").nullish()),
  texteEn: z.preprocess(videEnNull, z.string().max(5000, "texte_invalide").nullish()),
  slug: z.preprocess(
    videEnNull,
    z
      .string()
      .trim()
      .max(80, "slug_invalide")
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug_invalide")
      .nullish(),
  ),
  lienProduitId: z.preprocess(videEnNull, z.uuid("produit_inexistant").nullish()),
  images: z.array(imageSchema).max(10, "images_limite").default([]),
});

export type ArticleSchema = z.infer<typeof schemaArticle>;

// Erreur de champ rendue au formulaire : le message de validation est un code d'interface connu.
const CODES_VALIDATION: ReadonlySet<string> = new Set<CodeErreurBlog>([
  "article_invalide",
  "titre_invalide",
  "texte_invalide",
  "slug_invalide",
  "produit_inexistant",
  "article_introuvable",
  "publication_incomplete",
  "non_autorise",
  "format_invalide",
  "fichier_trop_lourd",
  "alt_invalide",
  "images_limite",
  "generique",
]);

export function codeErreurSchema(valeur: unknown): CodeErreurBlog {
  return typeof valeur === "string" && CODES_VALIDATION.has(valeur) ? (valeur as CodeErreurBlog) : "article_invalide";
}
