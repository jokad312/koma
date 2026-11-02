import type { CodePrestataire } from "./types";

// Adaptateurs réellement branchés. Un Prestataire dont l'adaptateur n'existe pas ne peut pas être activé : sans cela, le site annoncerait
// « Paiement traité par K-Pay » sans aucun moyen de payer (règles 13 et 14). Chaque story d'adaptateur ajoute ici son code :
// Polar (4.7), K-Pay (5.4 et 5.5), MaishaPay (5.6), PawaPay (5.7).
export const ADAPTATEURS_BRANCHES: ReadonlySet<CodePrestataire> = new Set<CodePrestataire>();

export function adaptateurBranche(code: CodePrestataire, branches: ReadonlySet<CodePrestataire> = ADAPTATEURS_BRANCHES): boolean {
  return branches.has(code);
}
