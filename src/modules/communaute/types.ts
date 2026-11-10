import type { Auteur } from "@/lib/auth/auteur";

// Photos des clients (story 8.1, FR-40, FR-41). Formats et limite annoncés au client ; le contenu réel est revérifié par le serveur.
export const PHOTO_CLIENT_TAILLE_MAX = 15 * 1024 * 1024;
export const FORMATS_PHOTO_CLIENT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

// Envoi en cours (purgé après 24 h s'il n'est jamais finalisé) puis photo vérifiée et nettoyée, en attente de validation.
// Le chemin d'envoi porte l'identifiant du Compte qui l'a demandé : finalisation et annulation vérifient qu'il est le sien.
export const CHEMIN_ENVOI_PHOTO =
  /^envois-photos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
export function compteDeLEnvoi(objet: string): string | null {
  return CHEMIN_ENVOI_PHOTO.exec(objet)?.[1] ?? null;
}
export const DOSSIER_PHOTOS_CLIENTS = "photos-clients";

// Version du texte de l'accord de publication : texte de Jonathan du 2026-11-08, précisé le même jour (« avec mon pseudo si je choisis
// de l'afficher »). Un nouveau texte = une nouvelle version ; les accords déjà donnés gardent la leur.
export const VERSION_ACCORD_PUBLICATION = "2026-11-08-v2";

// Limite d'envois par Compte (AD-22) : 10 demandes d'envoi par heure.
export const LIMITE_ENVOIS_PHOTO_PAR_HEURE = 10;

export type StatutPhoto = "en_attente" | "publiee" | "refusee" | "retiree";
// kitFr / kitEn : titre du Kit déclaré si la photo est une Réalisation (story 8.4), sinon null.
export type PhotoClient = {
  id: string;
  statut: StatutPhoto;
  nomAffiche: string | null;
  ville: string | null;
  retraitDemande: boolean;
  creeLe: string;
  apercu: string | null;
  kitFr: string | null;
  kitEn: string | null;
};

// Kit payé du Compte, déclarable pour une Réalisation (accès dont la Commande d'origine a un paye_le ; un Kit gratuit ne compte pas).
export type KitPaye = { id: string; titreFr: string; titreEn: string | null };

export type ErreurPhoto =
  | "non_connecte"
  | "mineur"
  | "format_invalide"
  | "fichier_trop_lourd"
  | "accord_manquant"
  | "affichage_invalide"
  | "trop_d_envois"
  | "kit_non_paye"
  | "introuvable"
  | "generique";

export type ResultatPhoto<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: ErreurPhoto };

// Mur public (story 8.3, FR-40, FR-42, AD-17, AD-18) : une entrée du mur « Ils le portent », telle que rendue.
export type TypeMur = "photo" | "realisation";

// Une entrée du mur : identité fermée, texte alternatif, pseudo autorisé, et (pour une Réalisation) le Kit lié publié.
// Les noms d'affichage sont en camelCase, ceux de la base en snake_case (noms des colonnes de `lister_mur_public`).
export type MurPublic = {
  id: string;
  // Chemin du bucket public `produits-public` (galerie/<uuid>.<ext>) ; l'adresse publique est construite par le lecteur.
  fichier: string;
  altFr: string;
  altEn: string;
  // Pseudonyme affiché, autorisé à l'affichage ; sans autorisation, rien n'est affiché (pas de fallback).
  pseudo: string | null;
  // Horodatage de publication (ISO 8601 UTC, microsecondes) : dernière clé de tri du mur, sert au curseur de pagination.
  valideLe: string;
  // Même instant en ISO UTC à la microseconde, tel que la base le rend pour le curseur (colonne `curseur_date`).
  curseurDate: string;
  type: TypeMur;
  // Réalisation validée : la mention « Fait avec un kit {nomSite} » s'affiche, le lien Kit seulement si le Kit est publié.
  faitAvecKit: boolean;
  kitSlug: string | null;
  kitTitreFr: string | null;
  kitTitreEn: string | null;
};

// Une page du mur : les entrées affichées, puis la suite (curseur opaque) ; null : plus rien à afficher.
export type PageMur = { murs: MurPublic[]; suite: string | null };

// Curseur de pagination : horodatage et identifiant de la dernière entrée affichée, nombre d'entrées déjà affichées.
export type CurseurMur = { date: string; id: string; n: number };

// 24 entrées par page (limite bornée de `lister_mur_public`) ; plafond de sécurité pour un curseur forgé.
export const TAILLE_PAGE_MURS = 24;
export const CUMUL_MAX_MURS = 1200;

export type DependancesCommunaute = {
  // null : non connecté ou Compte incomplet ; une panne de vérification lève.
  compte: () => Promise<{ compteId: string; auteur: Auteur } | null>;
  estMineur: (compteId: string) => Promise<boolean>;
  consommerEssai: (cle: string) => Promise<{ autorise: boolean } | { erreur: string }>;
  signerEnvoi: (objet: string) => Promise<{ jeton: string } | { erreur: string }>;
  lireObjet: (objet: string) => Promise<{ octets: Uint8Array } | { erreur: string }>;
  ecrireObjet: (args: { objet: string; octets: Uint8Array; contentType: string }) => Promise<{ erreur: string | null }>;
  supprimerObjet: (objet: string) => Promise<{ erreur: string | null }>;
  // kitId présent : Réalisation (story 8.4) ; le Kit doit être payé, vérifié par la base.
  deposer: (args: { auteur: Auteur; objet: string; nom: string | null; ville: string | null; kitId?: string | null }) => Promise<{ id: string } | { erreur: string }>;
  kitsPayes: (compteId: string) => Promise<{ kits: KitPaye[] } | { erreur: string }>;
  lister: (compteId: string) => Promise<{ photos: Omit<PhotoClient, "apercu">[]; objets: Record<string, string> } | { erreur: string }>;
  apercus: (objets: string[]) => Promise<Record<string, string>>;
  retirer: (auteur: Auteur, photoId: string) => Promise<{ resultat: "retiree" | "demande" | "deja_retiree"; objet: string } | { erreur: string }>;
};
