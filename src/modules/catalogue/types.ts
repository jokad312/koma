import type { AuteurCompte } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";
import type { FormatFichierKit } from "./fichiers-kit";

// Familles de produits physiques (cosplay, accessoire) ; la famille « kit » (numérique) est gérée par ses propres fonctions.
export const FAMILLES_PHYSIQUES = ["cosplay", "accessoire"] as const;
export type FamillePhysique = (typeof FAMILLES_PHYSIQUES)[number];

export const FAMILLES_PRODUIT = ["cosplay", "accessoire", "kit"] as const;
export type FamilleProduit = (typeof FAMILLES_PRODUIT)[number];

// Niveau d'un Kit (Débutant / Intermédiaire / Avancé ; Beginner / Intermediate / Advanced).
export const NIVEAUX_KIT = ["debutant", "intermediaire", "avance"] as const;
export type NiveauKit = (typeof NIVEAUX_KIT)[number];

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
  | "format_invalide"
  | "fichier_trop_lourd"
  | "alt_invalide"
  | "photos_limite"
  | "photo_introuvable"
  | "derniere_photo_publiee"
  | "publication_incomplete"
  | "tranche_libelle_invalide"
  | "tranche_bornes_invalides"
  | "tranches_trop_nombreuses"
  | "produit_publie_verrouille"
  | "niveau_invalide"
  | "kit_lie_invalide"
  | "fichier_introuvable"
  | "envoi_incomplet"
  | "fichier_deja_enregistre"
  | "contenu_actif"
  | "entete_illisible"
  | "kit_non_publiable"
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
  | "variantes"
  | "materiel_fr"
  | "materiel_en"
  | "niveau"
  | "kit_lie";

// Ce qui manque à un produit pour être publié, dans l'ordre d'affichage (le titre français est déjà obligatoire).
export const MANQUES_PUBLICATION = ["prix", "photo", "titre_en", "description_fr", "description_en", "variante"] as const;
export type ManquePublication = (typeof MANQUES_PUBLICATION)[number];

// Photos : formats acceptés, 15 Mo au plus, 10 photos au plus par produit.
export const FORMATS_PHOTO = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type TypePhoto = keyof typeof FORMATS_PHOTO;
export const PHOTO_TAILLE_MAX = 15 * 1024 * 1024;
export const PHOTOS_MAX = 10;

export type ChampUnivers = "nom_fr" | "nom_en";

// Tranches de prix du filtre des catalogues (réglage de l'admin) : 8 au plus, aucune tranche par défaut.
export const TRANCHES_MAX = 8;
export type ChampTranche = "libelle_fr" | "libelle_en" | "bas" | "haut";

// Tranche telle que le formulaire l'envoie : bornes en USD saisies en texte (borne haute vide = tranche ouverte).
export type EntreeTranche = { libelleFr: string; libelleEn: string; bas: string; haut: string };

// Ce que la base reçoit (fonction enregistrer_tranches_prix) : centimes entiers.
export type TrancheEcrite = { libelle_fr: string; libelle_en: string; bas_cents: number; haut_cents: number | null };

export type TranchePrix = { ordre: number; libelleFr: string; libelleEn: string; basCents: number; hautCents: number | null };

export type ErreurCatalogue = {
  ok: false;
  erreur: CodeErreurCatalogue;
  champ?: ChampProduit | ChampUnivers;
  // Taille concernée (erreur d'une variante).
  taille?: Taille;
  // Première adresse libre, proposée quand l'adresse choisie est déjà prise.
  slugPropose?: string;
  // Publication refusée : ce qui manque.
  manques?: ManquePublication[];
  // Tranche de prix concernée (rang de 1 à 8) et champ fautif.
  ligne?: number;
  champTranche?: ChampTranche;
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

// Kit tel que le formulaire l'envoie : toutes les valeurs arrivent en texte.
export type EntreeKit = {
  id: string;
  slug: string;
  titreFr: string;
  titreEn: string;
  descriptionFr: string;
  descriptionEn: string;
  materielFr: string;
  materielEn: string;
  universId: string;
  prix: string;
  niveau: string;
  produitLieId: string;
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

// Ce que la base reçoit (fonction enregistrer_kit) : centimes entiers (0 admis), null pour une valeur absente.
export type KitEcrit = {
  famille: "kit";
  slug: string;
  titre_fr: string;
  titre_en: string | null;
  description_fr: string | null;
  description_en: string | null;
  materiel_fr: string | null;
  materiel_en: string | null;
  univers_id: string | null;
  prix_cents: number | null;
  niveau: NiveauKit | null;
  produit_lie_id: string | null;
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
  // Photos (bucket privé galerie-attente puis copie nettoyée dans produits-public) : le serveur choisit le nom de l'objet.
  signerEnvoiPhoto(args: { objet: string }): Promise<{ erreur: string | null; jeton: string | null }>;
  lireObjetAttente(objet: string): Promise<{ erreur: string | null; octets: Uint8Array | null }>;
  ecrireObjetPublic(args: { objet: string; octets: Uint8Array; contentType: string }): Promise<{ erreur: string | null }>;
  supprimerObjets(args: { bucket: "galerie-attente" | "produits-public" | "kits-private"; objets: string[] }): Promise<{ erreur: string | null }>;
  ecrirePhoto(args: { auteur: AuteurCompte; produitId: string; fichier: string; altFr: string; altEn: string }): Promise<{ erreur: string | null; id: string | null }>;
  deplacerPhoto(args: { auteur: AuteurCompte; photoId: string; sens: "haut" | "bas" }): Promise<{ erreur: string | null }>;
  // Supprime la ligne (positions renumérotées par la base) et renvoie le fichier du bucket public, à effacer ensuite par supprimerObjets.
  supprimerPhoto(args: { auteur: AuteurCompte; photoId: string }): Promise<{ erreur: string | null; fichier: string | null }>;
  modifierAltPhoto(args: { auteur: AuteurCompte; photoId: string; altFr: string; altEn: string }): Promise<{ erreur: string | null }>;
  changerPublication(args: { auteur: AuteurCompte; id: string; publier: boolean }): Promise<{ erreur: string | null }>;
  // Remplace l'ensemble des tranches de prix (droit « reglages.modifier »).
  ecrireTranches(args: { auteur: AuteurCompte; tranches: TrancheEcrite[] }): Promise<{ erreur: string | null }>;
  // Vide l'étiquette de cache « reglages » (les tranches sont lues avec elle) : appelé seulement après la réponse réelle de la base.
  invaliderReglages(): Promise<void>;
  // Vide l'étiquette de cache « catalogue » (updateTag) : appelé seulement après la réponse réelle de la base.
  invaliderCatalogue(): Promise<void>;
  // Lit (et lève en cas d'erreur de lecture) l'état d'un produit pour la complétude ; null si inconnu.
  lireProduitComplet(id: string): Promise<ProduitPourPublication | null>;
  // Kits (story 3.1).
  ecrireKit(args: { auteur: AuteurCompte; id: string | null; kit: KitEcrit }): Promise<{ erreur: string | null; id: string | null }>;
  // Famille d'un produit (lève en cas d'erreur de lecture) ; null si inconnu.
  lireFamilleProduit(id: string): Promise<FamilleProduit | null>;
  // Format et produit d'un fichier de Kit (lève en cas d'erreur de lecture) ; null si inconnu.
  lireFichierKit(id: string): Promise<{ produitId: string; format: FormatFichierKit } | null>;
  // Vrai si ce chemin de kits-private est déjà enregistré dans fichier_kit_prive (lève en cas d'erreur de lecture).
  // Un objet référencé n'est JAMAIS effacé par un envoi, une finalisation ou une annulation.
  cheminKitEnregistre(chemin: string): Promise<boolean>;
  // Déplace un objet de kits-private vers un nouveau chemin choisi par le serveur (le jeton d'envoi ne vaut plus que pour l'ancien).
  deplacerObjetKit(args: { de: string; vers: string }): Promise<{ erreur: string | null }>;
  // Autorisation d'envoi vers kits-private : jeton signé pour l'objet choisi par le serveur.
  signerEnvoiFichierKit(args: { objet: string }): Promise<{ erreur: string | null; jeton: string | null }>;
  // Lit l'existence, la taille réelle et les premiers octets d'un objet de kits-private (jamais l'objet entier sauf une transcription).
  lireObjetKit(args: { objet: string; octets: number }): Promise<{ erreur: string | null; trouve: boolean; taille: number; debut: Uint8Array }>;
  ecrireFichierKit(args: {
    auteur: AuteurCompte;
    produitId: string;
    nomFr: string;
    nomEn: string;
    format: FormatFichierKit;
    taille: number;
    chemin: string;
  }): Promise<{ erreur: string | null; id: string | null }>;
  // Renvoie l'ancien chemin, à effacer ensuite par supprimerObjets.
  remplacerFichierKit(args: { auteur: AuteurCompte; fichierId: string; taille: number; chemin: string }): Promise<{ erreur: string | null; ancienChemin: string | null }>;
  // Renvoie le chemin de l'objet, à effacer ensuite par supprimerObjets.
  supprimerFichierKit(args: { auteur: AuteurCompte; fichierId: string }): Promise<{ erreur: string | null; chemin: string | null }>;
};

// Ce que la complétude d'un produit lit en base.
export type ProduitPourPublication = {
  prixCents: number | null;
  titreEn: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  nbPhotos: number;
  nbVariantes: number;
  publieLe: string | null;
};

export type PhotoAdmin = { id: string; fichier: string; altFr: string; altEn: string; position: number };

// Lectures admin.
export type UniversAdmin = { id: string; nomFr: string; nomEn: string };

export type ProduitListe = { id: string; famille: FamilleProduit; titreFr: string; slug: string; prixCents: number | null; publieLe: string | null };

export type VarianteAdmin = { taille: Taille; stock: number; fabricationSurCommande: boolean; delaiFabricationJours: number | null };

// Fichier d'un Kit pour l'admin : jamais le chemin de stockage.
export type FichierKitAdmin = { id: string; nomFr: string; nomEn: string; format: FormatFichierKit; tailleOctets: number; ordre: number; version: number };

// Cosplay ou accessoire qu'un Kit peut lier (sans Kit, ou déjà lié au Kit édité).
export type ProduitLiable = { id: string; titreFr: string; famille: FamillePhysique };

export type ProduitAdmin = {
  id: string;
  famille: FamilleProduit;
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
  photos: PhotoAdmin[];
  // Kit seulement (null / vide sinon).
  materielFr: string | null;
  materielEn: string | null;
  niveau: NiveauKit | null;
  produitLieId: string | null;
  fichiers: FichierKitAdmin[];
};

// Choix de la question « univers » : nom déjà rendu dans la langue de la route.
export type UniversChoix = { id: string; nom: string };

// ---- Catalogues publics (story 2.4) ----

// État de disponibilité calculé par la base (lister_catalogue, disponibilite_variantes) ; jamais de quantité : le public ne voit pas le stock exact.
// disponible (au-dessus du seuil), dernieres_pieces (de 1 au seuil inclus), sur_commande, complet (fabrication permise mais Plafond atteint),
// epuise (aucun stock et pas de fabrication). État d'un produit : le meilleur de ses variantes, dans cet ordre.
export const DISPONIBILITES = ["disponible", "dernieres_pieces", "sur_commande", "complet", "epuise"] as const;
export type Disponibilite = (typeof DISPONIBILITES)[number];

// Seuil « dernières pièces » : MIROIR de la fonction SQL seuil_dernieres_pieces() (unique source, migration 20261029100000). Le texte
// de l'interface ne montre jamais cette valeur ; elle ne sert qu'aux tests et à la documentation. Un test la compare à la migration.
export const SEUIL_DERNIERES_PIECES = 3;

// Filtre de disponibilité de l'adresse : en_stock couvre disponible et dernieres_pieces ; sur_commande est inchangé.
export const FILTRES_DISPONIBILITE = ["en_stock", "sur_commande"] as const;
export type FiltreDisponibilite = (typeof FILTRES_DISPONIBILITE)[number];

export const TRIS_CATALOGUE = ["nouveautes", "prix_asc", "prix_desc"] as const;
export type TriCatalogue = (typeof TRIS_CATALOGUE)[number];
export const TRI_PAR_DEFAUT: TriCatalogue = "nouveautes";

// 12 produits par page ; la base en lit 13 pour savoir s'il en reste.
export const TAILLE_PAGE_CATALOGUE = 12;

// Position dans la liste : la clé de tri du dernier produit vu (date de publication en nouveautés, prix en tri par prix) et son identifiant.
// `n` : nombre de produits déjà affichés quand ce curseur a été donné (multiple de 12, 240 au plus) ; l'adresse à curseur relit ces n produits
// depuis le début puis les 12 suivants, pour afficher la liste cumulée.
export type CurseurCatalogue = { date: string | null; prix: number | null; id: string; n: number };
export const CUMUL_MAX_CATALOGUE = 240;

// Ce que l'adresse d'un catalogue demande, une fois analysée (jamais d'erreur : une valeur mal formée est ignorée).
export type ParamsCatalogue = {
  univers: string | null;
  // Tranche de prix en centimes : bas inclus, haut exclu (null = tranche ouverte). Les deux nuls = pas de filtre de prix.
  prixBas: number | null;
  prixHaut: number | null;
  dispo: FiltreDisponibilite | null;
  tri: TriCatalogue;
  curseur: CurseurCatalogue | null;
};

export type CarteProduit = {
  id: string;
  slug: string;
  famille: FamillePhysique;
  titre: string;
  photoAlt: string;
  // Adresse publique de la première photo (calculée côté serveur).
  photoUrl: string;
  prixCents: number;
  disponibilite: Disponibilite;
};

export type PageCatalogue = {
  produits: CarteProduit[];
  // Curseur (opaque) de la page suivante ; null s'il n'en reste plus.
  suite: string | null;
};

// ---- Fiche d'un produit physique (story 2.5) ----

export type PhotoFiche = { url: string; alt: string };

// Une taille de la fiche : état et délai de fabrication effectif calculés par la base (disponibilite_variantes) ; jamais de quantité.
export type TailleFiche = { taille: Taille; etat: Disponibilite; delaiJours: number | null };

export type FicheProduit = {
  id: string;
  slug: string;
  famille: FamillePhysique;
  titre: string;
  // Texte de la langue de la page (repli sur le français) ; null si aucune description n'existe.
  description: string | null;
  prixCents: number;
  photos: PhotoFiche[];
  tailles: TailleFiche[];
};

export type ProduitPublie = { famille: FamillePhysique; slug: string };
