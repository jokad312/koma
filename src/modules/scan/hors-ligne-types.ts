// Scan hors ligne (story 7.8). Types et constantes partagés par le serveur et l'écran : aucune dépendance serveur, ce fichier est chargé dans le navigateur.

// Identifiant d'appareil : 32 hexadécimaux (128 bits) tirés au hasard par l'appareil.
export const MOTIF_APPAREIL = /^[0-9a-f]{32}$/;
// Même borne que la base (synchroniser_scans) : un lot de plus de 200 scans est refusé.
export const TAILLE_LOT_SYNCHRO = 200;
// Avec une liste hors ligne, un serveur qui ne répond pas dans ce délai (réseau très faible) ne bloque pas l'entrée : le scan est jugé sur la liste locale.
export const DELAI_SERVEUR_MS = 8000;
// Écran « Scan réservé » : l'état du Verrou est relu à cette cadence tant que l'écran est visible et en ligne.
export const SONDAGE_ETAT_MS = 20000;

// Une entrée de la liste hors ligne : j = SHA-256 du jeton, c = HMAC-SHA-256 du code court (clé du Verrou), n = nom du titulaire, t = rang du Type de pass.
// Jamais le jeton ni le code court en clair.
export type EntreeListe = { j: string; c: string; n: string; t: number };

export type TypePassListe = { fr: string; en: string | null };

// Réponse de telecharger_liste_hors_ligne, relue prudemment par le service.
export type ListeTelechargee = {
  verrouId: string;
  prisLe: string;
  expireLe: string;
  genereLe: string;
  evenementFr: string;
  evenementEn: string | null;
  // Clé du HMAC des codes courts (64 hexadécimaux) : importée côté appareil en CryptoKey non extractible, puis oubliée.
  cleCodeCourt: string;
  types: TypePassListe[];
  pass: EntreeListe[];
};

export type ErreurHorsLigne =
  | "non_connecte"
  | "non_autorise"
  | "evenement_invalide"
  | "appareil_invalide"
  | "verrou_pris"
  | "verrou_absent"
  | "verrou_libere_de_force"
  | "evenement_passe"
  | "lot_trop_grand"
  | "trop_d_essais"
  | "generique";

export type EtatVerrou = { etat: "libre" } | { etat: "autre" } | { etat: "moi"; prisLe: string; expireLe: string };

// Un scan fait hors ligne et affiché VALIDE sur l'appareil, tel qu'il part au serveur : une empreinte, jamais le jeton ni le code court.
export type ScanASynchroniser = { id: string; nature: "jeton" | "code"; empreinte: string; scanneLe: string };

export type BilanSynchro = { appliques: number; conflits: number; inconnus: number; invalides: number; dejaTraites: number };

export type StatutLiberation = "libere" | "deja" | "force";

export type ResultatPrise = { ok: true; liste: ListeTelechargee } | { ok: false; erreur: ErreurHorsLigne };
export type ResultatSynchroServeur = { ok: true; bilan: BilanSynchro } | { ok: false; erreur: ErreurHorsLigne };
export type ResultatLiberation = { ok: true; statut: StatutLiberation } | { ok: false; erreur: ErreurHorsLigne };
export type ResultatEtat = { ok: true; etat: EtatVerrou } | { ok: false; erreur: ErreurHorsLigne };
export type ResultatForcage = { ok: true; statut: "force" | "aucun" } | { ok: false; erreur: ErreurHorsLigne };
