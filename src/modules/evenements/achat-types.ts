import type { Auteur } from "@/lib/auth/auteur";
import type { CodePromoRecap, CodeRefuse } from "@/modules/commande/types";

// Version du texte de la mention sur la publication des photos et vidéos de l'Événement, enregistrée avec l'acceptation (AD-34).
// À changer dès que Jonathan fournit le texte définitif : les acceptations déjà données gardent leur version.
export const VERSION_PASS_PHOTOS = "v0-provisoire";

// Plafond technique de personnes par Commande de Pass (la base le revérifie) : borne une saisie forgée, sans rapport avec la Capacité.
export const MAX_PASS_PAR_COMMANDE = 20;
export const NOM_TITULAIRE_MIN = 2;
export const NOM_TITULAIRE_MAX = 80;

// Codes d'erreur de l'achat de Pass : le texte vient de messages/*.json (Festival.achat.erreurs).
export type CodeErreurAchat =
  | "non_connecte"
  | "compte_incomplet"
  | "invalide"
  | "titulaire" // un nom de titulaire n'est pas valable
  | "mention" // la mention photos et vidéos n'est pas acceptée
  | "complet" // Capacité de l'Événement ou quota d'un Type atteint
  | "vente_fermee"
  | "evenement_introuvable"
  | "type_introuvable"
  | "stand" // un Stand ne s'obtient que sur candidature
  | "gratuit"
  | "commande_en_attente"
  | "total_change"
  | "reglage_manquant"
  | "erreur"
  | CodeRefuse;

export type ResultatAchat<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreurAchat };

// Ligne du Récapitulatif de Pass, relue en base : nom du Type, prix, noms des titulaires nettoyés par le serveur.
export type LigneRecapPass = {
  typePassId: string;
  nom: string;
  nombre: number;
  prixCents: number;
  reductionCents: number;
  titulaires: string[];
};

export type RecapPass = {
  lignes: LigneRecapPass[];
  personnes: number;
  sousTotalCents: number;
  reductionCents: number;
  code: CodePromoRecap | null;
  totalCents: number;
};

export type RecapPassBrut = {
  lignes: {
    type_pass_id: string;
    nom_fr: string;
    nom_en: string | null;
    prix_cents: number;
    nombre: number;
    titulaires: string[];
    reduction_cents?: number;
  }[];
  personnes: number;
  sous_total_cents: number;
  reduction_cents?: number;
  code?: { valide: boolean; erreur?: string; code?: string; reduction_pct?: number | string } | null;
  total_cents: number;
};

export type LignePassBase = { type_pass_id: string; titulaires: string[] };

// État de la vente relu à chaque requête (jamais en cache, AD-17). « types » : quels Types sont complets. Aucun compteur de places.
export type EtatVente = {
  etat: "a_venir" | "fermee" | "complet" | "aucun" | "ouverte";
  types: { id: string; complet: boolean }[];
};

// Ce que le service attend de l'extérieur (en test, des faux nommés TEST_ les remplacent).
export type DependancesAchat = {
  // Session vérifiée + Compte complet ; lève une erreur portant le code KS_NON_CONNECTE, KS_COMPTE_INCOMPLET ou KS_VERIFICATION_IMPOSSIBLE.
  exigerCompte: () => Promise<{ compteId: string; auteur: Auteur }>;
  // Nom donné par le Compte (Google), ou null : jamais inventé.
  nomDuCompte: (compteId: string) => Promise<string | null>;
  recapitulatif: (e: { compteId: string; evenementId: string; lignes: LignePassBase[]; code: string | null }) => Promise<{ recap: RecapPassBrut } | { erreur: string }>;
  creerCommande: (e: {
    auteur: Auteur;
    evenementId: string;
    lignes: LignePassBase[];
    acceptations: { objet: string; version: string }[];
    totalAttenduCents: number;
    cleIdempotence: string;
    code: string | null;
  }) => Promise<{ numero: string; expireLe: string } | { erreur: string }>;
};
