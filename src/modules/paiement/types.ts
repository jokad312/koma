// Couche de paiement (story 4.5, AD-5, AD-6). Types communs : aucun import de Supabase ni d'un autre module (le port est pur).

export const CODES_PRESTATAIRE = ["pawapay", "maishapay", "polar"] as const;
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
  // Le nom du payeur n'est connu que si le Compte l'a donné (Google) : jamais inventé (règle 15).
  contact: { telephone: string | null; email: string | null; nom: string | null };
  // Réseau de la carte choisi par le client (Visa ou Mastercard) ; null hors paiement par carte.
  reseauCarte: "VISA" | "MASTERCARD" | null;
  // Adresse où le client revient après le paiement (page de retour) et adresse que le Prestataire appelle pour signaler le résultat.
  adresseRetour: string;
  adresseNotification: string;
};

// Les deux références d'une Tentative : la nôtre (toujours connue) et celle du Prestataire (connue après l'initiation, parfois jamais).
export type ReferencesTentative = { referenceInterne: string; referenceTransaction: string | null };

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

// Notification telle que reçue : méthode, en-têtes, corps brut et chaîne de requête (certains Prestataires rappellent en GET).
export type RequeteNotification = { methode: "GET" | "POST"; en_tetes: Readonly<Record<string, string>>; corps: string; requete: string };

// Notification dont la signature est vérifiée ; null si la vérification échoue (la route répond 401).
export type NotificationVerifiee = { idNotification: string; referenceInterne: string | null; resultat: ResultatAdaptateur };

export type ComparaisonMontant = "egal" | "inferieur" | "superieur" | "indetermine";

export interface PrestatairePaiement {
  readonly code: CodePrestataire;
  // Points que la documentation du Prestataire ne tranche pas (signature, devise débitée, règle de comparaison, Couverture…). Tant que la liste
  // n'est pas vide, l'adaptateur n'est pas activable (règle 15) : rien n'est deviné, rien n'est validé sur une hypothèse.
  readonly questionsOuvertes: readonly string[];
  initier(tentative: DonneesTentative): Promise<ResultatInitiation>;
  verifierNotification(requete: RequeteNotification): Promise<NotificationVerifiee | null>;
  consulterStatut(references: ReferencesTentative): Promise<ResultatAdaptateur>;
  // Règle de comparaison propre au Prestataire (conversion faite par l'agrégateur, selon sa documentation) : jamais devinée.
  comparerMontant(attenduCents: number, montantRecu: string, deviseRecue: string): ComparaisonMontant;
}
