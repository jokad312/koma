import type { Auteur } from "@/lib/auth/auteur";
import type { ModeRemise, ZoneRemise } from "./schemas";

export type CodeErreurCommande =
  | "non_connecte"
  | "compte_incomplet"
  | "licence"
  | "deja_possede"
  | "indisponible"
  | "invalide"
  | "erreur"
  | "acceptation" // CGV, accès immédiat du Kit ou engagement sur mesure non coché
  | "telephone"
  | "adresse"
  | "remise"
  | "total_change" // le total relu en base n'est plus celui que le client a vu
  | "recap_change" // même total, mais disponibilité ou délai d'une ligne changés depuis l'affichage
  | "commande_en_attente" // le Compte a déjà une Commande à payer
  | "reglage_manquant"
  | "panier_vide"
  | "panier_introuvable";

export type ResultatCommande<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreurCommande };

export type CompteVerifie = { compteId: string; auteur: Auteur };

// Ligne du Récapitulatif telle que la base la relit (jamais figée par le Panier).
export type LigneRecap = {
  ligneId: string;
  produitId: string;
  famille: "cosplay" | "accessoire" | "kit";
  slug: string;
  titre: string;
  taille: string | null;
  nombre: number;
  prixCents: number;
  etat: "disponible" | "sur_commande" | "epuise";
  origine: "stock" | "fabrication" | null;
  delaiFabricationJours: number | null;
};

export type Recapitulatif = {
  lignes: LigneRecap[];
  physique: boolean;
  kit: boolean;
  surMesure: boolean;
  sousTotalCents: number;
  forfaitCents: number;
  totalCents: number;
  // Au moins une ligne n'est plus disponible : la commande est bloquée.
  indisponible: boolean;
  // Produit physique dans le Panier mais Zone et Mode pas encore choisis.
  remiseManquante: boolean;
  // Empreinte des lignes (nombre, origine, délai annoncé) à renvoyer à la création.
  empreinte: string;
};

export type RecapBrut = {
  lignes: {
    ligne_id: string;
    produit_id: string;
    famille: string;
    slug: string;
    titre_fr: string;
    titre_en: string | null;
    taille: string | null;
    nombre: number;
    prix_cents: number | null;
    etat: string;
    origine: string | null;
    delai_fabrication_jours: number | null;
  }[];
  physique: boolean;
  kit: boolean;
  sur_mesure: boolean;
  sous_total_cents: number;
  forfait_cents: number;
  total_cents: number;
  indisponible: boolean;
  remise_manquante: boolean;
  empreinte: string;
};

// Ce que le service attend de l'extérieur (en test, des faux nommés TEST_ les remplacent).
export type DependancesCommande = {
  // Session vérifiée + Compte complet ; lève une erreur portant le code KS_NON_CONNECTE, KS_COMPTE_INCOMPLET ou KS_VERIFICATION_IMPOSSIBLE.
  exigerCompte: () => Promise<CompteVerifie>;
  // Panier du cookie que ce Compte peut utiliser, ou null.
  panierDuCompte: (compteId: string) => Promise<string | null>;
  // Appelle offrir_commande ; renvoie le message d'erreur de la base (code KS_…) ou le numéro de la Commande.
  offrirCommande: (e: {
    auteur: Auteur;
    produitId: string;
    acceptations: { objet: string; version: string }[];
    cleIdempotence: string;
  }) => Promise<{ erreur: string | null; numero?: string }>;
  recapitulatif: (e: { compteId: string; panierId: string; zone: ZoneRemise | null; mode: ModeRemise | null }) => Promise<{ recap: RecapBrut } | { erreur: string }>;
  creerCommande: (e: {
    auteur: Auteur;
    panierId: string;
    zone: ZoneRemise | null;
    mode: ModeRemise | null;
    telephone: string | null;
    adresse: string | null;
    acceptations: { objet: string; version: string }[];
    origine: string | null;
    totalAttenduCents: number;
    empreinte: string;
    cleIdempotence: string;
  }) => Promise<{ numero: string; expireLe: string } | { erreur: string }>;
};
