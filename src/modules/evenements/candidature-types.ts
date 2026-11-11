import type { Auteur } from "@/lib/auth/auteur";

// Candidature Stand (story 7.11, FR-33b, AD-37). Version du texte de la case d'engagement « propres créations, aucune contrefaçon », enregistrée avec la
// candidature (AD-34). Texte de l'epic du 2026-11-10 ; un nouveau texte = une nouvelle version.
export const VERSION_ENGAGEMENT_STAND = "2026-11-10-v1";

export const NOMBRE_PHOTOS_CANDIDATURE = 3;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 1000;
export const PHOTO_CANDIDATURE_TAILLE_MAX = 15 * 1024 * 1024;
export const FORMATS_PHOTO_CANDIDATURE = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
// Limite de demandes d'envoi par Compte et par heure (AD-22) : une demande = les trois photos d'une candidature.
export const LIMITE_DEMANDES_CANDIDATURE_PAR_HEURE = 6;

// Envoi en cours : l'objet porte l'identifiant du Compte qui l'a demandé (finalisation et nettoyage vérifient qu'il est le sien).
export const CHEMIN_ENVOI_CANDIDATURE =
  /^envois-candidatures\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
export function compteDeLEnvoiCandidature(objet: string): string | null {
  return CHEMIN_ENVOI_CANDIDATURE.exec(objet)?.[1] ?? null;
}

// Forme de l'Instagram : @pseudo ou lien instagram.com (la base revérifie la même règle).
export const INSTAGRAM_PSEUDO = /^@?[A-Za-z0-9._]{1,30}$/;
export const INSTAGRAM_LIEN = /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?(\?[^\s]{0,100})?$/;
export function instagramValable(valeur: string): boolean {
  const v = valeur.trim();
  return INSTAGRAM_PSEUDO.test(v) || INSTAGRAM_LIEN.test(v);
}

// Description : 20 à 1 000 caractères, sans < ni >, sans caractère de contrôle (retours à la ligne permis). Les caractères de liaison des émojis composés
// (U+200D, U+200C) et les sélecteurs de variante sont permis ; les autres caractères invisibles (U+200B, U+202E...) sont refusés. La base revérifie.
const CONTROLE_DESCRIPTION = /[\p{Cc}\p{Cs}\p{Cf}]/u;
export function descriptionValable(texte: string): boolean {
  const longueur = [...texte].length;
  if (longueur < DESCRIPTION_MIN || longueur > DESCRIPTION_MAX || /[<>]/.test(texte)) return false;
  return !CONTROLE_DESCRIPTION.test(texte.replace(/[\n\r\t\u200c\u200d]/g, " "));
}

export type ErreurCandidature =
  | "non_connecte"
  | "compte_incomplet"
  | "invalide"
  | "format_invalide"
  | "fichier_trop_lourd"
  | "engagement_manquant"
  | "description_invalide"
  | "instagram_invalide"
  | "trop_d_envois"
  | "complet"
  | "deja_candidat"
  | "candidature_refusee"
  | "vente_fermee"
  | "evenement_introuvable"
  | "type_introuvable"
  | "reglage_manquant"
  | "generique";

export type ResultatCandidature<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: ErreurCandidature };

export type DependancesCandidature = {
  // Compte complet de la session ; null sans session ou Compte incomplet (la raison est dans « raison »).
  compte: () => Promise<{ compteId: string; auteur: Auteur } | { erreur: "non_connecte" | "compte_incomplet" }>;
  consommerEssai: (cle: string) => Promise<{ autorise: boolean } | { erreur: string }>;
  // Pré-contrôle en lecture (candidature_stand_possible) : code de l'obstacle (KS_...) ou null si le Compte peut candidater.
  verifierPossible: (e: { compteId: string; evenementId: string; typePassId: string }) => Promise<{ obstacle: string | null } | { erreur: string }>;
  signerEnvoi: (objet: string) => Promise<{ jeton: string } | { erreur: string }>;
  lireObjet: (objet: string) => Promise<{ octets: Uint8Array } | { erreur: string }>;
  ecrireObjet: (e: { objet: string; octets: Uint8Array; contentType: string }) => Promise<{ erreur: string | null }>;
  supprimerObjet: (objet: string) => Promise<{ erreur: string | null }>;
  deposer: (e: {
    auteur: Auteur;
    id: string;
    evenementId: string;
    typePassId: string;
    description: string;
    instagram: string;
    photos: string[];
    versionEngagement: string;
  }) => Promise<{ expireLe: string } | { erreur: string }>;
};

// Paiement d'un Stand accepté (page de paiement). Compte du candidat seulement : la base revérifie la propriété.
export type ErreurPaiementStand =
  | "non_connecte"
  | "compte_incomplet"
  | "invalide"
  | "titulaire"
  | "mention"
  | "introuvable"
  | "expiree"
  | "refusee"
  | "deja_commandee"
  | "vente_fermee"
  | "commande_en_attente"
  | "total_change"
  | "reglage_manquant"
  | "gratuit"
  | "erreur"
  | "code_inconnu"
  | "code_inactif"
  | "code_plafond"
  | "code_premier_achat"
  | "code_un_seul"
  | "code_total_nul";

export type ResultatPaiementStand<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: ErreurPaiementStand };

export type RecapStandBrut = {
  candidature_id: string;
  evenement_id: string;
  expire_le: string;
  type_pass_id: string;
  nom_fr: string;
  nom_en: string | null;
  prix_cents: number;
  reduction_cents: number;
  sous_total_cents: number;
  total_cents: number;
  code?: { valide: boolean; erreur?: string; code?: string; reduction_pct?: number | string } | null;
};

export type RecapStand = {
  candidatureId: string;
  expireLe: string;
  nom: string;
  prixCents: number;
  reductionCents: number;
  totalCents: number;
  code: { valide: true; code: string; reductionPct: number } | { valide: false; erreur: string } | null;
};

export type DependancesPaiementStand = {
  exigerCompte: () => Promise<{ compteId: string; auteur: Auteur }>;
  nomDuCompte: (compteId: string) => Promise<string | null>;
  // Nom provisoire du Pass de l'aide (texte des messages, dans la langue de l'exposant) : remplacé plus tard depuis « Mes Pass ».
  nomAideProvisoire: (langue: "fr" | "en") => Promise<string>;
  recapitulatif: (e: { compteId: string; candidatureId: string; code: string | null }) => Promise<{ recap: RecapStandBrut } | { erreur: string }>;
  creerCommande: (e: {
    auteur: Auteur;
    candidatureId: string;
    acceptations: { objet: string; version: string }[];
    totalAttenduCents: number;
    cleIdempotence: string;
    nomTitulaire: string;
    nomAide: string;
    aideASaisir: boolean;
    code: string | null;
  }) => Promise<{ numero: string; expireLe: string } | { erreur: string }>;
};

// Nommer l'aide depuis « Mes Pass ».
export type ErreurNommerAide = "non_connecte" | "compte_incomplet" | "invalide" | "nom_invalide" | "introuvable" | "deja_saisi" | "evenement_commence" | "generique";
export type ResultatNommerAide = { ok: true } | { ok: false; erreur: ErreurNommerAide };
export type DependancesNommerAide = {
  compte: DependancesCandidature["compte"];
  nommer: (e: { auteur: Auteur; passId: string; nom: string }) => Promise<{ erreur: string | null }>;
};
