import type { CodePrestataire, PrestatairePaiement } from "./types";

// Adaptateurs réellement branchés. Un Prestataire dont l'adaptateur n'existe pas ne peut pas être activé : sans cela, le site annoncerait
// « Paiement traité par MaishaPay » sans aucun moyen de payer (règles 13 et 14). Chaque story d'adaptateur ajoute le sien ici :
// Polar (4.7), MaishaPay mobile money (5.6), MaishaPay carte (5.9), PawaPay (5.7). K-Pay est abandonné (2026-11-03). Aucun adaptateur de test n'entre jamais dans cette liste.
const ADAPTATEURS: Partial<Record<CodePrestataire, PrestatairePaiement>> = {};

export const ADAPTATEURS_BRANCHES: ReadonlySet<CodePrestataire> = new Set(Object.keys(ADAPTATEURS) as CodePrestataire[]);

export function adaptateurBranche(code: CodePrestataire, branches: ReadonlySet<CodePrestataire> = ADAPTATEURS_BRANCHES): boolean {
  return branches.has(code);
}

export function lireAdaptateur(code: CodePrestataire): PrestatairePaiement | null {
  return ADAPTATEURS[code] ?? null;
}
