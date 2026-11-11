// Pass d'un Compte (story 7.5), tels que « Mes Pass » les affiche. Aucune valeur inventée : un champ absent en base reste null.
export type StatutPass = "valide" | "scanne" | "annule" | "rembourse";

export type PassLu = {
  id: string;
  nomTitulaire: string;
  statut: StatutPass;
  // Nom du Type de pass figé à l'achat, dans la langue demandée.
  typeNom: string;
  // Secret du Code QR et code court : lus pour le seul Compte acheteur, jamais journalisés.
  jeton: string;
  codeCourt: string;
  // Commande de Pass offerte (story 8.5) : la carte porte « Offert ».
  offert: boolean;
  evenement: { id: string; slug: string; titre: string; debutLe: string | null; finLe: string | null; lieu: string | null };
};

export type GroupePass = { evenement: PassLu["evenement"]; avenir: boolean; pass: PassLu[] };

// Annulation d'un Pass (story 7.9) : le bouton n'existe que si la base dit « annulable » (Pass payé, valide, Événement à plus de 48 h, frais connus).
export type AnnulationPass = {
  possible: boolean;
  // Frais retenus en pourcentage (figés à l'achat, sinon réglage du jour) ; null : inconnus, le bouton n'est jamais proposé.
  fraisPct: number | null;
  // Pass d'un Stand : l'autre titulaire est annulé avec lui.
  stand: boolean;
  // Dernière demande du Compte pour ce Pass : en cours ou refusée.
  demande: "ouverte" | "refusee" | null;
};
