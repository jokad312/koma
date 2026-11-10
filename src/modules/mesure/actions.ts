// Story 9.7 : actions mesurées (FR-54, AD-19). Liste fermée, la même que le « check » de la table evenement_mesure.
// Toute valeur absente d'ici est refusée par Zod puis par la base : aucun nom d'événement inventé côté navigateur.

// Actions d'une page publique.
export const ACTIONS_PUBLIQUES = [
  "clic_heros",
  "chargement_heros",
  "vue_fiche",
  "ajout_panier",
  "partage_fiche",
] as const;

// Actions autorisées depuis /compte (dérogation de Jonathan du 2026-11-10) : la page enregistrée est toujours « /compte ».
// Le Kit gratuit peut aussi être obtenu depuis une fiche publique : il figure dans les deux listes.
export const ACTIONS_COMPTE = [
  "photo_envoyee",
  "realisation_envoyee",
  "kit_gratuit_recupere",
  "video_kit_demarree",
  "video_kit_terminee",
] as const;

// Actions qui n'existent que dans l'espace privé : elles exigent la page « /compte ».
export const ACTIONS_PRIVEES = ["photo_envoyee", "realisation_envoyee", "video_kit_demarree", "video_kit_terminee"] as const;

export const ACTIONS_MESURE = [
  "clic_heros",
  "chargement_heros",
  "vue_fiche",
  "ajout_panier",
  "partage_fiche",
  "kit_gratuit_recupere",
  "photo_envoyee",
  "realisation_envoyee",
  "video_kit_demarree",
  "video_kit_terminee",
] as const;

export type ActionMesure = (typeof ACTIONS_MESURE)[number];

export function estActionMesure(valeur: string): valeur is ActionMesure {
  return (ACTIONS_MESURE as readonly string[]).includes(valeur);
}
