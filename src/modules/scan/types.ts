// Scan en ligne à l'entrée (story 7.6). Types partagés par le serveur et l'écran (aucune dépendance serveur).
export const RAISONS_REFUS = ["inconnu", "deja_scanne", "annule", "rembourse", "autre_evenement", "commande_non_payee", "qr_invalide"] as const;
export type RaisonRefus = (typeof RAISONS_REFUS)[number];

// « verrouille » (story 7.8) : un autre appareil tient le Verrou hors ligne de l'Événement. « stockage » : le scan n'a pas pu être gardé sur l'appareil (hors ligne).
export type ErreurScan = "evenement_invalide" | "saisie_invalide" | "non_connecte" | "non_autorise" | "trop_d_essais" | "verrouille" | "stockage" | "liste_expiree" | "generique";

export type ResultatScan =
  | { ok: true; resultat: "valide"; nom: string; evenement: string; typePass: string }
  // scanneLe : heure du premier scan (ISO), seulement pour « deja_scanne ».
  | { ok: true; resultat: "refuse"; raison: RaisonRefus; scanneLe: string | null }
  | { ok: false; erreur: ErreurScan };

// Ce que la base rend (scanner_pass) : le service le relit prudemment, jamais de confiance aveugle.
export type ReponseScanBase =
  | { resultat: "valide"; nom: string; evenementFr: string; evenementEn: string | null; typePassFr: string; typePassEn: string | null }
  | { resultat: "refuse"; raison: Exclude<RaisonRefus, "qr_invalide">; scanneLe: string | null };

// appareil : identifiant de l'appareil (story 7.8), utile seulement si un Verrou hors ligne est tenu pour l'Événement.
export type EntreeScan = { evenementId: unknown; langue: unknown; charge?: unknown; code?: unknown; appareil?: unknown };

export type AuteurScan = { type: "compte"; id: string; role: string | null };

export type DependancesScan = {
  // Droit de scanner les Pass de CET Événement : Admin (« pass.scanner ») ou bénévole dont l'accès est valable maintenant pour cet Événement (story 7.7).
  // Vérifié en base ; lève KS_NON_CONNECTE / KS_DROIT_REFUSE.
  exigerAcces: (evenementId: string) => Promise<{ auteur: AuteurScan }>;
  empreinteValeur: (valeur: string) => string;
  empreinteClient: () => Promise<string | null>;
  consommerEssai: (a: { cle: string; fenetreSecondes: number; maximum: number }) => Promise<{ erreur: string | null; autorise: boolean }>;
  scanner: (a: { auteur: AuteurScan; evenementId: string; jeton: string | null; code: string | null; appareil: string | null }) => Promise<{ erreur: string | null; reponse: ReponseScanBase | null }>;
};

export type EvenementScannable = { id: string; titre: string; debutLe: string | null; finLe: string | null };
