import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import type { Article, ArticleImage, ArticleListe } from "./types";

// La table article n'est pas encore dans src/lib/supabase/types.ts (types générés, jamais modifiés à la main) :
// les seules colonnes lues sont décrites ici, et les lignes sont converties avant de sortir du module.
type LigneArticle = {
  id: string;
  auteur_id: string;
  titre_fr: string;
  titre_en: string | null;
  texte_fr: string | null;
  texte_en: string | null;
  slug: string | null;
  lien_produit_id: string | null;
  images: unknown;
  publie_le: string | null;
  cree_le: string;
  modifie_le: string;
};

type ReponseListe = { data: LigneArticle[] | null; error: { message: string } | null };
type ReponseUne = { data: LigneArticle | null; error: { message: string } | null };

type ClientArticle = {
  from(table: "article"): {
    select(colonnes: string): {
      order(colonne: string, options: { ascending: boolean }): PromiseLike<ReponseListe>;
      eq(colonne: string, valeur: string): { maybeSingle(): PromiseLike<ReponseUne> };
    };
  };
};

function client(): ClientArticle {
  return creerClientService() as unknown as ClientArticle;
}

// Photos d'un article : seules les entrées complètes et au bon chemin sont rendues, jamais une valeur brute de la base.
function lireImages(brut: unknown): ArticleImage[] {
  if (!Array.isArray(brut)) return [];
  const images: ArticleImage[] = [];
  for (const item of brut) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.fichier !== "string" || typeof o.alt_fr !== "string" || typeof o.alt_en !== "string") continue;
    images.push({ fichier: o.fichier, altFr: o.alt_fr, altEn: o.alt_en });
  }
  return images;
}

function versArticle(ligne: LigneArticle): Article {
  return {
    id: ligne.id,
    auteurId: ligne.auteur_id,
    titreFr: ligne.titre_fr,
    titreEn: ligne.titre_en,
    texteFr: ligne.texte_fr ?? "",
    texteEn: ligne.texte_en,
    slug: ligne.slug,
    lienProduitId: ligne.lien_produit_id,
    images: lireImages(ligne.images),
    publieLe: ligne.publie_le,
    creeLe: ligne.cree_le,
    modifieLe: ligne.modifie_le,
  };
}

// Liste admin (droit vérifié par la page) : une erreur de lecture est relancée, jamais une liste vide inventée.
export async function lireArticlesAdmin(): Promise<ArticleListe[]> {
  const { data, error } = await client()
    .from("article")
    .select("id, titre_fr, slug, publie_le, modifie_le")
    .order("modifie_le", { ascending: false });
  if (error) throw new Error("Lecture des articles impossible.");
  return (data ?? []).map((a) => ({ id: a.id, titreFr: a.titre_fr, slug: a.slug, publieLe: a.publie_le, modifieLe: a.modifie_le }));
}

// Un article complet pour le formulaire d'édition ; null si l'identifiant est inconnu (404).
export async function lireArticleAdmin(id: string): Promise<Article | null> {
  const { data, error } = await client()
    .from("article")
    .select("id, auteur_id, titre_fr, titre_en, texte_fr, texte_en, slug, lien_produit_id, images, publie_le, cree_le, modifie_le")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Lecture de l'article impossible.");
  return data ? versArticle(data) : null;
}
