import type { AuteurCompte } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";

// Familles de produits physiques de cette phase (la famille « kit » arrive à l'epic 3).
export const FAMILLES_PHYSIQUES = ["cosplay", "accessoire"] as const;
export type FamillePhysique = (typeof FAMILLES_PHYSIQUES)[number];

export const TAILLES = ["XS", "S", "M", "L", "XL", "XXL", "sur_mesure"] as const;
export type Taille = (typeof TAILLES)[number];

// Codes d'erreur renvoyés par les actions : le texte vient de messages/*.json, côté interface.
export type CodeErreurCatalogue =
  | "non_autorise"
  | "famille_invalide"
  | "titre_invalide"
  | "slug_invalide"
  | "slug_pris"
  | "prix_invalide"
  | "delai_invalide"
  | "univers_invalide"
  | "texte_invalide"
  | "taille_invalide"
  | "stock_invalide"
  | "delai_manquant"
  | "nom_invalide"
  | "univers_existe"
  | "produit_introuvable"
  | "generique";

// Champ du formulaire de produit auquel une erreur se rattache (absent : erreur du formulaire entier).
export type ChampProduit =
  | "famille"
  | "titre_fr"
  | "titre_en"
  | "slug"
  | "description_fr"
  | "description_en"
  | "univers"
  | "prix"
  | "delai"
  | "variantes";

export type ChampUnivers = "nom_fr" | "nom_en";

export type ErreurCatalogue = {
  ok: false;
  erreur: CodeErreurCatalogue;
  champ?: ChampProduit | ChampUnivers;
  // Taille concernée (erreur d'une variante).
  taille?: Taille;
  // Première adresse libre, proposée quand l'adresse choisie est déjà prise.
  slugPropose?: string;
};

export type ResultatCatalogue<T extends object = object> = ({ ok: true } & T) | ErreurCatalogue;

// Variante telle que le formulaire l'envoie : toutes les valeurs arrivent en texte (jamais un nombre déjà « deviné »).
export type EntreeVariante = { taille: string; stock: string; surCommande: boolean; delai: string };

export type EntreeProduit = {
  id: string;
  famille: string;
  slug: string;
  titreFr: string;
  titreEn: string;
  descriptionFr: string;
  descriptionEn: string;
  universId: string;
  prix: string;
  delai: string;
  variantes: EntreeVariante[];
};

export type EntreeUnivers = { nomFr: string; nomEn: string };

// Ce que la base reçoit (fonction enregistrer_produit) : centimes entiers, null pour une valeur absente.
export type ProduitEcrit = {
  famille: FamillePhysique;
  slug: string;
  titre_fr: string;
  titre_en: string | null;
  description_fr: string | null;
  description_en: string | null;
  univers_id: string | null;
  prix_cents: number | null;
  delai_fabrication_jours: number | null;
};

export type VarianteEcrite = {
  taille: Taille;
  stock: number;
  fabrication_sur_commande: boolean;
  delai_fabrication_jours: number | null;
};

// Ce que le service attend du serveur : en production, les vrais clients ; en test, des faux nommés TEST_.
export type DependancesCatalogue = {
  // Refuse (lève) si le Compte connecté n'a pas le droit ; renvoie l'auteur construit depuis la session vérifiée.
  exigerDroit(droit: Droit): Promise<{ auteur: AuteurCompte }>;
  ecrireUnivers(args: { auteur: AuteurCompte; nomFr: string; nomEn: string }): Promise<{ erreur: string | null; id: string | null }>;
  ecrireProduit(args: {
    auteur: AuteurCompte;
    id: string | null;
    produit: ProduitEcrit;
    variantes: VarianteEcrite[];
  }): Promise<{ erreur: string | null; id: string | null }>;
  // Première adresse libre à partir d'une base (en excluant le produit lui-même).
  premierSlugLibre(base: string, exclureId: string | null): Promise<string>;
};

// Lectures admin.
export type UniversAdmin = { id: string; nomFr: string; nomEn: string };

export type ProduitListe = { id: string; famille: FamillePhysique; titreFr: string; slug: string; prixCents: number | null; publieLe: string | null };

export type VarianteAdmin = { taille: Taille; stock: number; fabricationSurCommande: boolean; delaiFabricationJours: number | null };

export type ProduitAdmin = {
  id: string;
  famille: FamillePhysique;
  slug: string;
  titreFr: string;
  titreEn: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  universId: string | null;
  prixCents: number | null;
  delaiFabricationJours: number | null;
  publieLe: string | null;
  variantes: VarianteAdmin[];
};

// Choix de la question « univers » : nom déjà rendu dans la langue de la route.
export type UniversChoix = { id: string; nom: string };
