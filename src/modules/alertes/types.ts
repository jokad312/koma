import type { AuteurCompte, AuteurVisiteur } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";

// « Me prévenir » (story 7.3, FR-32) : l'inscription est PAR ÉVÉNEMENT et l'email part à l'ouverture de la vente de cet événement
// (décision de Jonathan du 2026-11-11). Trois canaux : email, Compte, WhatsApp (numéros exportés par l'admin, aucun message envoyé par le site).
export const CANAUX_ALERTE = ["email", "compte", "whatsapp"] as const;
export type CanalAlerte = (typeof CANAUX_ALERTE)[number];

// Version du texte de consentement affiché, gardée avec l'inscription (AD-34). Un nouveau texte = une nouvelle version.
// Texte « email » fourni par Jonathan le 2026-11-11 (canaux email et Compte) ; texte « WhatsApp » écrit par l'assistant, à valider.
export const VERSION_CONSENTEMENT_ALERTE: Record<CanalAlerte, string> = {
  email: "alerte-email-2026-11-11",
  compte: "alerte-email-2026-11-11",
  whatsapp: "alerte-whatsapp-2026-11-11",
};

// Codes renvoyés par l'action : le texte vient de messages/*.json, côté interface.
export type CodeErreurAlerte = "champs" | "trop_d_essais" | "vente_ouverte" | "indisponible" | "non_connecte" | "compte_incomplet" | "generique";
export type ChampAlerte = "canal" | "email" | "whatsapp" | "consentement";
export type CodeChampAlerte = "canal_requis" | "email_invalide" | "whatsapp_invalide" | "consentement_requis";

export type ResultatAlerte = { ok: true } | { ok: false; erreur: CodeErreurAlerte; champs: Partial<Record<ChampAlerte, CodeChampAlerte>> };

export type ArgumentsInscription = {
  auteur: AuteurCompte | AuteurVisiteur;
  evenementId: string;
  canal: CanalAlerte;
  // Adresse ou numéro normalisés ; null pour le canal Compte.
  valeur: string | null;
  langue: "fr" | "en";
  version: string;
};

export type DependancesAlertes = {
  // null : non connecté. Un Compte incomplet (âge non déclaré) fait lever Error("KS_COMPTE_INCOMPLET"), traité par le service.
  compte(): Promise<{ compteId: string; auteur: AuteurCompte } | null>;
  // Empreinte (hachage à clé) de l'adresse IP ; null si absente. L'adresse brute n'est jamais stockée.
  empreinteClient(): Promise<string | null>;
  empreinteValeur(valeur: string): string;
  consommerEssai(args: { cle: string; fenetreSecondes: number; maximum: number }): Promise<{ erreur: string | null; autorise: boolean }>;
  inscrire(args: ArgumentsInscription): Promise<{ erreur: string | null }>;
  // Tâche planifiée : pose dans la boîte d'envoi les emails des événements dont la vente vient d'ouvrir.
  planifier(): Promise<{ erreur: string | null; nombre: number }>;
};

export type NombresAlertes = { email: number; compte: number; whatsapp: number; desinscrits: number };

export type DependancesExportAlertes = {
  exigerDroit(droit: Droit): Promise<{ auteur: AuteurCompte }>;
  exporterNumeros(args: { auteur: AuteurCompte; evenementId: string }): Promise<{ erreur: string | null; numeros: string[] }>;
};
