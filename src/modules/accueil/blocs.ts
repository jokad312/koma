// Liste ordonnée des blocs de la page d'accueil (FR-2). Seule source de l'ordre.
// Un emplacement « reserve » n'affiche rien : ni espace, ni titre, ni texte. Il garde sa place pour l'epic qui le remplira.
// Chaque emplacement porte le numéro du bloc dans FR-2 et l'epic qui l'ajoute.
export type BlocAccueil =
  | { id: "heros"; numero: null; etat: "affiche" }
  | { id: "categories"; numero: null; etat: "affiche" }
  | { id: "kits"; numero: 1; etat: "reserve"; arrivePar: "epic 3" }
  | { id: "cosplaysRecents"; numero: 2; etat: "affiche" }
  | { id: "galerie"; numero: 3; etat: "reserve"; arrivePar: "epic 3" }
  | { id: "rendezVousOtaku"; numero: 4; etat: "reserve"; arrivePar: "epic 8" }
  | { id: "guides"; numero: 5; etat: "reserve"; arrivePar: "epic 7" }
  | { id: "jonathan"; numero: 6; etat: "affiche" }
  | { id: "bloc7"; numero: 7; etat: "reserve"; arrivePar: "epic 8" }
  | { id: "faqCourte"; numero: 8; etat: "affiche" };

export const BLOCS_ACCUEIL: readonly BlocAccueil[] = [
  { id: "heros", numero: null, etat: "affiche" },
  { id: "categories", numero: null, etat: "affiche" },
  { id: "kits", numero: 1, etat: "reserve", arrivePar: "epic 3" },
  { id: "cosplaysRecents", numero: 2, etat: "affiche" },
  { id: "galerie", numero: 3, etat: "reserve", arrivePar: "epic 3" },
  { id: "rendezVousOtaku", numero: 4, etat: "reserve", arrivePar: "epic 8" },
  { id: "guides", numero: 5, etat: "reserve", arrivePar: "epic 7" },
  { id: "jonathan", numero: 6, etat: "affiche" },
  { id: "bloc7", numero: 7, etat: "reserve", arrivePar: "epic 8" },
  { id: "faqCourte", numero: 8, etat: "affiche" },
];

// Blocs réellement rendus, dans l'ordre.
export function blocsAffiches(): BlocAccueil[] {
  return BLOCS_ACCUEIL.filter((b) => b.etat === "affiche");
}

// Questions de la FAQ courte (paiement, livraison, délais) : les entrées de l'espace de messages `Faq`, sans copie.
export const QUESTIONS_FAQ_COURTE = ["paiement", "livraison", "delais"] as const;

// Nombre de cosplays du bloc 2.
export const NB_COSPLAYS_ACCUEIL = 4;
