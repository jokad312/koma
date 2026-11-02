import type { AuteurCompte } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";

// Codes d'erreur renvoyés par les actions du module blog : le texte vient de messages/*.json, côté interface.
export type CodeErreurBlog =
  | "article_invalide"
  | "titre_invalide"
  | "texte_invalide"
  | "slug_invalide"
  | "slug_pris"
  | "slug_publie"
  | "produit_inexistant"
  | "article_introuvable"
  | "publication_incomplete"
  | "non_autorise"
  | "format_invalide"
  | "fichier_trop_lourd"
  | "alt_invalide"
  | "images_limite"
  | "generique";

export type ResultatBlog<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreurBlog };

export type ArticleImage = { fichier: string; altFr: string; altEn: string };

export type Article = {
  id: string;
  auteurId: string;
  titreFr: string;
  titreEn: string | null;
  texteFr: string;
  texteEn: string | null;
  slug: string | null;
  lienProduitId: string | null;
  images: ArticleImage[];
  publieLe: string | null;
  creeLe: string;
  modifieLe: string;
};

// Ligne de la liste admin : de quoi choisir l'article à ouvrir, sans lire les textes.
export type ArticleListe = {
  id: string;
  titreFr: string;
  slug: string | null;
  publieLe: string | null;
  modifieLe: string;
};

// ---- Lecture publique (story 8.7) ----

// Carte de la liste publique : vignette (première image, ou aucune), titre et date de la langue.
export type CarteArticle = {
  id: string;
  slug: string;
  titre: string;
  publieLe: string;
  vignetteUrl: string | null;
  vignetteAlt: string | null;
};

export type ArticleImagePublique = { url: string; alt: string };

export type ProduitLie = { titre: string; famille: "cosplay" | "accessoire" | "kit"; slug: string };

export type ArticlePublic = {
  id: string;
  slug: string;
  titre: string;
  texte: string;
  publieLe: string;
  modifieLe: string;
  images: ArticleImagePublique[];
  produitLie: ProduitLie | null;
  // Version anglaise réellement publiée : commande le 404 sous /en et le hreflang.
  versionAnglaise: boolean;
};

export type PageArticles = { articles: CarteArticle[]; suite: string | null };

// Curseur de pagination : date et identifiant du dernier article affiché, nombre déjà affiché (12, 24, …).
export type CurseurArticles = { date: string; id: string; n: number };

// 12 Articles par page (FR-43, E-36) ; plafond de sécurité pour un curseur forgé.
export const TAILLE_PAGE_ARTICLES = 12;
export const CUMUL_MAX_ARTICLES = 1200;

// Choix de lien vers un Produit : seuls le titre et l'identifiant servent au formulaire.
export type ProduitLien = { id: string; titreFr: string };

// Règles d'images de l'article : mêmes limites et mêmes formats que les photos de produit (story 2.2).
export const IMAGES_ARTICLE_MAX = 10;
export const IMAGE_ARTICLE_TAILLE_MAX = 15 * 1024 * 1024;
export const FORMATS_IMAGE_ARTICLE = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type TypeImageArticle = keyof typeof FORMATS_IMAGE_ARTICLE;

// Objet d'attente et fichier public : articles/<uuid>.<ext>. Le navigateur ne choisit jamais un autre chemin.
export const CHEMIN_IMAGE_ARTICLE = /^articles\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

// Ce que le service attend du serveur : en production, les vrais clients ; en test, des faux nommés TEST_.
export type DependancesBlog = {
  // Refuse (lève) si le Compte connecté n'a pas le droit ; renvoie l'auteur construit depuis la session vérifiée.
  exigerDroit(droit: Droit): Promise<{ auteur: AuteurCompte }>;
  enregistrerArticle(args: { auteur: AuteurCompte; id: string | null; article: object; images: object }): Promise<{ erreur: string | null; id: string | null }>;
  changerPublication(args: { auteur: AuteurCompte; id: string; publier: boolean }): Promise<{ erreur: string | null }>;
  // Images déjà enregistrées sur l'article (avant écriture) : celles retirées du formulaire seront effacées après la sauvegarde.
  lireImagesArticle(id: string): Promise<ArticleImage[]>;
  signerEnvoiImage(args: { objet: string }): Promise<{ erreur: string | null; jeton: string | null }>;
  lireObjetAttente(objet: string): Promise<{ erreur: string | null; octets: Uint8Array | null }>;
  ecrireObjetPublic(args: { objet: string; octets: Uint8Array; contentType: string }): Promise<{ erreur: string | null }>;
  supprimerObjet(args: { bucket: string; objet: string }): Promise<{ erreur: string | null }>;
  // Étiquette « articles » vidée après une écriture : le public relit la base.
  invaliderArticles(): Promise<void>;
};
