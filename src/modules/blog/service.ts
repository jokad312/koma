import type { DependancesBlog, ResultatBlog, CodeErreurBlog, Article, ArticleImage } from "./types";
import { schemaArticle } from "./schemas";

// Erreurs de la base propres à l'article (module blog) et leur code d'interface.
const ERREURS_ARTICLE: ReadonlyArray<readonly [string, CodeErreurBlog]> = [
  ["KS_ARTICLE_INVALIDE", "article_invalide"],
  ["KS_TITRE_INVALIDE", "titre_invalide"],
  ["KS_TEXTE_INVALIDE", "texte_invalide"],
  ["KS_SLUG_INVALIDE", "slug_invalide"],
  ["KS_PRODUIT_INEXISTANT", "produit_inexistant"],
  ["KS_ARTICLE_INTROUVABLE", "article_introuvable"],
  ["KS_PUBLICATION_INCOMPLETE", "publication_incomplete"],
  ["KS_DROIT_REFUSE", "non_autorise"],
  ["KS_AUTEUR_MANQUANT", "non_autorise"],
];

function erreurArticle(erreur: string): CodeErreurBlog {
  return ERREURS_ARTICLE.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

// Crée (id vide) ou modifie un brouillon d'article : droit, validation, une seule écriture atomique.
export async function enregistrerArticle(
  deps: DependancesBlog,
  entree: { id: string | null; article: { titreFr: string; texteFr: string; titreEn: string | null; texteEn: string | null; slug: string | null; lienProduitId: string | null; images: ArticleImage[] } },
): Promise<ResultatBlog<{ id: string; cree: boolean }>> {
  const droit = await deps.exigerDroit("blog.gerer");
  const lu = schemaArticle.safeParse(entree.article);
  if (!lu.success) {
    // Le message de validation d'un champ est le code d'interface correspondant (titre_invalide, texte_invalide…).
    const message = lu.error.issues[0]?.message;
    return { ok: false, erreur: typeof message === "string" && message ? (message as CodeErreurBlog) : "article_invalide" };
  }
  try {
    const { erreur, id } = await deps.enregistrerArticle({ auteur: droit.auteur, id: entree.id, article: lu.data, images: lu.data.images });
    if (erreur) {
      // La journalisation est automatique via la trigger article_journaliser ; on retient juste le code d'interface.
      return { ok: false, erreur: erreurArticle(erreur) };
    }
    if (!id) return { ok: false, erreur: "generique" };
    return { ok: true, id, cree: entree.id === null };
  } catch (e) {
    return { ok: false, erreur: "generique" };
  }
}

// Publie (publier = true) ou dépublie (publier = false) un article : droit, refus si la publication est incomplète.
export async function changerPublication(deps: DependancesBlog, entree: { id: string; publier: boolean }): Promise<ResultatBlog<{ id: string }>> {
  const droit = await deps.exigerDroit("blog.gerer");
  try {
    const { erreur } = await deps.changerPublication({ auteur: droit.auteur, id: entree.id, publier: entree.publier });
    if (erreur) {
      if (erreur.includes("KS_PUBLICATION_INCOMPLETE")) return { ok: false, erreur: "publication_incomplete" };
      if (erreur.includes("KS_ARTICLE_INTROUVABLE")) return { ok: false, erreur: "article_introuvable" };
      if (erreur.includes("KS_DROIT_REFUSE") || erreur.includes("KS_AUTEUR_MANQUANT")) return { ok: false, erreur: "non_autorise" };
      return { ok: false, erreur: "generique" };
    }
    return { ok: true, id: entree.id };
  } catch (e) {
    return { ok: false, erreur: "generique" };
  }
}