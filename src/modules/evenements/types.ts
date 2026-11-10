import type { AuteurCompte } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";

// Codes d'erreur des actions du module evenements : le texte vient de messages/*.json, côté interface.
export type CodeErreurEvenement =
  | "evenement_invalide"
  | "titre_invalide"
  | "texte_invalide"
  | "slug_invalide"
  | "slug_pris"
  | "lieu_invalide"
  | "date_invalide"
  | "capacite_invalide"
  | "type_pass_invalide"
  | "prix_invalide"
  | "quota_invalide"
  | "evenement_introuvable"
  | "type_pass_introuvable"
  | "publication_incomplete"
  | "non_autorise"
  | "format_invalide"
  | "fichier_trop_lourd"
  | "alt_invalide"
  | "images_limite"
  | "generique";

// « manques » : ce qui empêche la publication (clés connues de l'interface), seulement avec publication_incomplete.
export type ResultatEvenement<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreurEvenement; manques?: string[] };

export type ImageEvenement = { fichier: string; altFr: string; altEn: string };

export type LieuType = "salle" | "plein_air";

export type TypePass = {
  id: string;
  nomFr: string;
  nomEn: string | null;
  prixCents: number;
  quota: number | null;
  inclusFr: string | null;
  inclusEn: string | null;
  estStand: boolean;
};

export type Evenement = {
  id: string;
  titreFr: string;
  titreEn: string | null;
  slug: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  lieuType: LieuType | null;
  lieuFr: string | null;
  lieuEn: string | null;
  debutLe: string | null;
  finLe: string | null;
  capacite: number | null;
  venteOuvreLe: string | null;
  venteFermeLe: string | null;
  images: ImageEvenement[];
  publieLe: string | null;
  modifieLe: string;
  types: TypePass[];
};

export type EvenementListe = { id: string; titreFr: string; debutLe: string | null; publieLe: string | null; modifieLe: string };

// Codes de manques_publication_evenement : ce qui empêche la publication.
export const MANQUES_PUBLICATION = ["titre_fr", "titre_en", "description_fr", "description_en", "date", "lieu", "photo", "type_pass", "types_incomplets"] as const;

export const IMAGES_EVENEMENT_MAX = 10;
export const IMAGE_EVENEMENT_TAILLE_MAX = 15 * 1024 * 1024;
export const FORMATS_IMAGE_EVENEMENT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

// Objet d'attente et fichier public : evenements/<uuid>.<ext>. Le navigateur ne choisit jamais un autre chemin.
export const CHEMIN_IMAGE_EVENEMENT = /^evenements\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

// Heure de Goma (Africa/Lubumbashi, UTC+2 toute l'année, sans heure d'été) : l'admin saisit et lit à cette heure.
export const DECALAGE_BOUTIQUE = "+02:00";

export type EntreeType = {
  id: string | null;
  nomFr: string;
  nomEn: string | null;
  prixUsd: string;
  quota: string | null;
  inclusFr: string | null;
  inclusEn: string | null;
  estStand: boolean;
};

export type EntreeEvenement = {
  titreFr: string;
  titreEn: string | null;
  slug: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  lieuType: LieuType | null;
  lieuFr: string | null;
  lieuEn: string | null;
  // « AAAA-MM-JJTHH:mm » à l'heure de Goma, ou null.
  debut: string | null;
  fin: string | null;
  venteOuvre: string | null;
  venteFerme: string | null;
  capacite: string | null;
  images: ImageEvenement[];
  types: EntreeType[];
};

export type DependancesEvenements = {
  exigerDroit(droit: Droit): Promise<{ auteur: AuteurCompte }>;
  enregistrerEvenement(args: { auteur: AuteurCompte; id: string | null; evenement: object; types: object }): Promise<{ erreur: string | null; id: string | null }>;
  changerPublication(args: { auteur: AuteurCompte; id: string; publier: boolean }): Promise<{ erreur: string | null }>;
  lireImagesEvenement(id: string): Promise<ImageEvenement[]>;
  signerEnvoiImage(args: { objet: string }): Promise<{ erreur: string | null; jeton: string | null }>;
  lireObjetAttente(objet: string): Promise<{ erreur: string | null; octets: Uint8Array | null }>;
  ecrireObjetPublic(args: { objet: string; octets: Uint8Array; contentType: string }): Promise<{ erreur: string | null }>;
  supprimerObjet(args: { bucket: string; objet: string }): Promise<{ erreur: string | null }>;
  // Étiquette « evenements » vidée après une écriture : le public relit la base.
  invaliderEvenements(): Promise<void>;
};
