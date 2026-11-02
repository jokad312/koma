export type LangueEmail = "fr" | "en";
export type ModeleEnvoi = "commande_payee" | "kit_ouvert";

// Envoi réservé par le lot : uniquement des identifiants (jamais d'adresse ni de montant).
export type EnvoiReserve = {
  id: string;
  modele: string;
  compteId: string;
  langue: LangueEmail;
  donnees: Record<string, string>;
  tentatives: number;
};

export type MessageEmail = { sujet: string; html: string; texte: string };

// Résultat du rendu, relu en base au moment de l'envoi.
export type ResultatRendu =
  | { statut: "pret"; destinataire: string; message: MessageEmail }
  | { statut: "ignorer"; raison: string }
  | { statut: "reessayer"; raison: string };

export type ResultatEnvoiPrestataire = { erreur: string | null; idPrestataire: string | null };

export type DependancesEnvois = {
  reserverLot: (limite: number) => Promise<{ erreur: string | null; envois: EnvoiReserve[] }>;
  rendre: (envoi: EnvoiReserve) => Promise<ResultatRendu>;
  envoyer: (args: { envoiId: string; destinataire: string; message: MessageEmail }) => Promise<ResultatEnvoiPrestataire>;
  marquerEnvoye: (envoiId: string, idPrestataire: string) => Promise<{ erreur: string | null }>;
  marquerEchec: (envoiId: string, erreur: string) => Promise<{ erreur: string | null }>;
  ignorer: (envoiId: string, raison: string) => Promise<{ erreur: string | null }>;
};

export type BilanLot = { reserves: number; envoyes: number; ignores: number; reessais: number; erreurBase: boolean };
