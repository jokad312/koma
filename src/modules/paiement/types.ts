// Couche de paiement (story 4.5, AD-5, AD-6). Types communs : aucun import de Supabase ni d'un autre module (le port est pur).

export const CODES_PRESTATAIRE = ["pawapay", "kpay", "maishapay", "polar"] as const;
export type CodePrestataire = (typeof CODES_PRESTATAIRE)[number];

export type MoyenPaiement = "mobile_money" | "carte";
export type FamilleProduit = "cosplay" | "accessoire" | "kit";

// Un Prestataire tel que la base le décrit. Les moyens qu'il propose sont fixes (règle 10) ; seuls « actif » et l'ordre se règlent.
export type Prestataire = {
  code: CodePrestataire;
  nom: string;
  type: "agregateur" | "carte";
  mobileMoney: boolean;
  carte: boolean;
  actif: boolean;
  // Ordre de priorité des Agrégateurs (1 = interrogé en premier) ; null pour le Prestataire carte seul.
  ordre: number | null;
};

// Ce que la Commande contient, lu en base (règle 11) : jamais ce que le navigateur annonce.
export type Achat = { familles: readonly FamilleProduit[]; estPass: boolean };

// Couverture d'un Agrégateur : un couple pays-opérateur qu'il sait encaisser (saisie à la story 5.1, tirée de sa documentation).
export type Couverture = ReadonlyArray<{ prestataire: CodePrestataire; pays: string; operateur: string }>;

// ---- Port PrestatairePaiement (AD-5) : implémenté par chaque adaptateur, sans aucun accès à la base ----

export type DonneesTentative = {
  referenceInterne: string;
  montantAttenduCents: number;
  moyen: MoyenPaiement;
  pays: string | null;
  operateur: string | null;
  // Le téléphone ou l'email du payeur ne sont jamais conservés par nous : ils passent par l'appel seulement.
  contact: { telephone: string | null; email: string | null };
  adresseRetour: string;
};

export type ResultatInitiation =
  | { statut: "initie"; referenceTransaction: string | null; redirection: string | null }
  | { statut: "refuse"; cause: "client" | "prestataire" };

// Résultat normalisé d'une vérification (notification signée ou contre-vérification du statut), avec le montant et la devise reçus tels
// que le Prestataire les renvoie. « inconnu » laisse la Tentative en cours ; seul « succes » avec le bon montant peut valider (règle 2).
export type ResultatAdaptateur = {
  statut: "succes" | "echec_client" | "echec_prestataire" | "inconnu";
  referenceTransaction: string | null;
  montantRecu: string | null;
  deviseRecue: string | null;
};

export type RequeteNotification = { en_tetes: Readonly<Record<string, string>>; corps: string };

// Notification dont la signature est vérifiée ; null si la vérification échoue (la route répond 401).
export type NotificationVerifiee = { idNotification: string; referenceInterne: string | null; resultat: ResultatAdaptateur };

export type ComparaisonMontant = "egal" | "inferieur" | "superieur" | "indetermine";

export interface PrestatairePaiement {
  readonly code: CodePrestataire;
  initier(tentative: DonneesTentative): Promise<ResultatInitiation>;
  verifierNotification(requete: RequeteNotification): Promise<NotificationVerifiee | null>;
  consulterStatut(referenceTransaction: string): Promise<ResultatAdaptateur>;
  // Règle de comparaison propre au Prestataire (conversion faite par l'agrégateur, selon sa documentation) : jamais devinée.
  comparerMontant(attenduCents: number, montantRecu: string, deviseRecue: string): ComparaisonMontant;
}
