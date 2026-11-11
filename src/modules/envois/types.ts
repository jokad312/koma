export type LangueEmail = "fr" | "en";
export type ModeleEnvoi = "commande_payee" | "kit_ouvert" | "commande_en_fabrication" | "commande_expediee" | "commande_livree" | "commande_annulee" | "commande_remboursee" | "pass_emis";

// Envoi réservé par le lot : uniquement des identifiants (jamais d'adresse ni de montant).
export type EnvoiReserve = {
  id: string;
  modele: string;
  // null : inscrit par email sans Compte (modèle alerte_evenement seulement, story 7.3).
  compteId: string | null;
  langue: LangueEmail;
  donnees: Record<string, string>;
  tentatives: number;
};

// entetes : en-têtes supplémentaires (Emails commerciaux : List-Unsubscribe et List-Unsubscribe-Post, RFC 8058).
// Envoi lié à un Compte (tous les modèles sauf l'alerte d'un inscrit par email).
export type EnvoiLie = EnvoiReserve & { compteId: string };

// pieces : fichiers joints, affichables dans le HTML par leur contentId (« cid: »), par exemple les Codes QR des Pass (story 7.5).
export type PieceJointe = { nom: string; contenu: Buffer; type: string; contentId: string };

export type MessageEmail = { sujet: string; html: string; texte: string; entetes?: Record<string, string>; pieces?: PieceJointe[] };

// Résultat du rendu, relu en base au moment de l'envoi.
export type ResultatRendu =
  | { statut: "pret"; destinataire: string; message: MessageEmail }
  | { statut: "ignorer"; raison: string }
  | { statut: "reessayer"; raison: string };

// Emails commerciaux (AD-9, story 9.4) : seuls ces modèles passent par email_commercial_autorise ; un email lié à un achat
// (commande, paiement, statut, Kit ouvert, Pass) n'y passe jamais. Gabarits : 9.6 (panier, rappel de Kit, nouveau produit) et 7.3 (alerte_evenement) ; 9.5 (relance) à venir.
export const MODELES_COMMERCIAUX = ["relance", "panier_abandonne", "rappel_kit", "nouveau_produit", "alerte_evenement"] as const;

export type AutorisationCommerciale = { erreur: string } | { autorise: true } | { autorise: false; motif: string };

export type ResultatEnvoiPrestataire ={ erreur: string | null; idPrestataire: string | null };

export type DependancesEnvois = {
  reserverLot: (limite: number) => Promise<{ erreur: string | null; envois: EnvoiReserve[] }>;
  rendre: (envoi: EnvoiReserve) => Promise<ResultatRendu>;
  autorisationCommerciale: (envoiId: string) => Promise<AutorisationCommerciale>;
  envoyer: (args: { envoiId: string; destinataire: string; message: MessageEmail }) => Promise<ResultatEnvoiPrestataire>;
  marquerEnvoye: (envoiId: string, idPrestataire: string) => Promise<{ erreur: string | null }>;
  marquerEchec: (envoiId: string, erreur: string) => Promise<{ erreur: string | null }>;
  ignorer: (envoiId: string, raison: string) => Promise<{ erreur: string | null }>;
};

export type BilanLot = { reserves: number; envoyes: number; ignores: number; reessais: number; erreurBase: boolean };
