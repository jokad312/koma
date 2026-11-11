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
