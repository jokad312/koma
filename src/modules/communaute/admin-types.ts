import type { AuteurCompte } from "@/lib/auth/auteur";

// Galerie côté personnel (story 8.2) : droit galerie.valider (Admin et Assistant).
export type PhotoAdmin = {
  id: string;
  statut: "en_attente" | "publiee";
  source: "compte" | "whatsapp";
  nomAffiche: string | null;
  ville: string | null;
  retraitDemande: boolean;
  creeLe: string;
  accordWhatsappLe: string | null;
  capture: boolean;
  // Réalisation (story 8.4) : Kit déclaré et preuve d'achat (Commande payée) ; rang fixé à la validation. null pour une photo simple.
  realisation: { kitFr: string; kitEn: string | null; commande: string; payeLe: string; rang: number | null } | null;
  // Aperçu : adresse signée de courte durée (en attente, bucket privé) ou adresse publique (publiée).
  apercu: string | null;
};

export type ErreurGalerie =
  | "non_autorise"
  | "introuvable"
  | "deja_traitee"
  | "mineur"
  | "accord_manquant"
  | "majorite"
  | "affichage_invalide"
  | "compte_introuvable"
  | "format_invalide"
  | "fichier_trop_lourd"
  | "photo_illisible"
  | "generique";

export type ResultatGalerie<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: ErreurGalerie };

// Envoi du personnel vers galerie-attente (photo reçue par WhatsApp ou capture de l'accord), purgé après 24 h s'il n'est pas finalisé.
export const CHEMIN_ENVOI_ADMIN = /^envois-admin\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
export const BUCKET_ACCORDS = "accords-whatsapp";

export type DepotWhatsapp = {
  objetPhoto: string;
  objetCapture: string | null;
  email: string;
  afficherNom: boolean;
  nom: string;
  afficherVille: boolean;
  ville: string;
  accordLe: string;
  accordRecu: boolean;
  majeur: boolean;
};

export type DependancesGalerie = {
  // Lève DroitRefuseError si le Compte n'a pas le droit galerie.valider.
  exigerDroit: () => Promise<{ auteur: AuteurCompte }>;
  lister: (auteur: AuteurCompte) => Promise<{ photos: Omit<PhotoAdmin, "apercu">[]; objets: Record<string, { objet: string; fichierPublic: string | null }> } | { erreur: string }>;
  apercusPrives: (objets: string[]) => Promise<Record<string, string>>;
  urlPublique: (fichier: string) => string;
  lirePhoto: (id: string) => Promise<{ objet: string; statut: string; fichierPublic: string | null } | null | { erreur: string }>;
  lireAttente: (objet: string) => Promise<{ octets: Uint8Array } | { erreur: string }>;
  ecrireAttente: (args: { objet: string; octets: Uint8Array; contentType: string }) => Promise<{ erreur: string | null }>;
  ecrirePublic: (args: { fichier: string; octets: Uint8Array; contentType: string }) => Promise<{ erreur: string | null }>;
  ecrireCapture: (args: { fichier: string; octets: Uint8Array; contentType: string }) => Promise<{ erreur: string | null }>;
  supprimerAttente: (objet: string) => Promise<{ erreur: string | null }>;
  supprimerPublic: (fichier: string) => Promise<{ erreur: string | null }>;
  supprimerCapture: (fichier: string) => Promise<{ erreur: string | null }>;
  signerEnvoiAdmin: (objet: string) => Promise<{ jeton: string } | { erreur: string }>;
  valider: (auteur: AuteurCompte, id: string, fichierPublic: string) => Promise<{ erreur: string | null }>;
  refuser: (auteur: AuteurCompte, id: string) => Promise<{ objet: string } | { erreur: string }>;
  retirer: (auteur: AuteurCompte, id: string) => Promise<{ fichierPublic: string | null; objet: string } | { erreur: string }>;
  trouverCompte: (auteur: AuteurCompte, email: string) => Promise<{ compteId: string | null } | { erreur: string }>;
  deposer: (args: {
    auteur: AuteurCompte;
    objet: string;
    compteId: string | null;
    nom: string | null;
    ville: string | null;
    accordLe: string;
    majeur: boolean;
    capture: string | null;
  }) => Promise<{ id: string } | { erreur: string }>;
  invaliderGalerie: () => void;
};
