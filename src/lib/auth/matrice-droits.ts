import type { RoleAuteur } from "./auteur";

// Matrice des droits (AD-13, FR-53). Refus par défaut : un droit absent des listes ci-dessous n'est accordé à personne
// d'autre que l'Admin, et un rôle inconnu n'a rien.
export const DROITS = [
  // Accordés à l'Assistant (FR-53).
  "commandes.voir",
  "commandes.changer_statut",
  "mesures.verifier",
  "galerie.valider",
  "blog.gerer",
  "remboursement.preparer",
  "activite.propre",
  // Réservés à l'Admin. « evenements.gerer » : décision de Jonathan du 2026-11-10, Admin seulement pour l'instant
  // (la base refuse déjà l'Assistant sur les fonctions d'écriture des Événements).
  "evenements.gerer",
  // Scan des Pass à l'entrée (story 7.6) : Admin seulement pour l'instant ; l'accès du bénévole, limité à son Événement et à son jour, est la story 7.7.
  "pass.scanner",
  "admin.acceder",
  "produits.modifier",
  "prix.modifier",
  "codes_promo.gerer",
  "commissions.gerer",
  "prestataires.gerer",
  "chiffre_affaires.voir",
  "paiements.graphiques",
  "benevoles.acces",
  "remboursement.valider",
  "reglages.modifier",
  "roles.gerer",
  "age.corriger",
  "messages.traiter",
] as const;

export type Droit = (typeof DROITS)[number];

export const DROITS_ASSISTANT: ReadonlySet<Droit> = new Set<Droit>([
  "commandes.voir",
  "commandes.changer_statut",
  "mesures.verifier",
  "galerie.valider",
  "blog.gerer",
  "remboursement.preparer",
  "activite.propre",
]);

// Fonction pure : le rôle vient de la base (lireRole), jamais d'une saisie. Le bénévole n'a aucun droit admin.
export function droitAutorise(role: RoleAuteur, droit: Droit): boolean {
  if (role === "admin") return (DROITS as readonly string[]).includes(droit);
  if (role === "assistant") return DROITS_ASSISTANT.has(droit);
  return false;
}
