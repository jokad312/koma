import type { AuteurCompte } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";

// Codes d'erreur renvoyés par les actions du module blog : le texte vient de messages/*.json, côté interface.
export type CodeErreurBlog =
  | "article_invalide"
  | "titre_invalide"
  | "texte_invalide"
  | "slug_invalide"
  | "produit_inexistant"
  | "article_introuvable"
  | "publication_incomplete"
  | "non_autorise"
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

// Ce que le service attend du serveur : en production, les vrais clients ; en test, des faux nommés TEST_.
export type DependancesBlog = {
  // Refuse (lève) si le Compte connecté n'a pas le droit ; renvoie l'auteur construit depuis la session vérifiée.
  exigerDroit(droit: Droit): Promise<{ auteur: AuteurCompte }>;
  enregistrerArticle(args: { auteur: AuteurCompte; id: string | null; article: object; images: object }): Promise<{ erreur: string | null; id: string | null }>;
  changerPublication(args: { auteur: AuteurCompte; id: string; publier: boolean }): Promise<{ erreur: string | null }>;
};
