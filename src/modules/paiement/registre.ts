import { creerAdaptateurMaishaPay, type ConfigMaishaPay } from "./adaptateurs/maishapay";
import type { CodePrestataire, PrestatairePaiement } from "./types";

// Clés de l'application dédiée au site chez MaishaPay, lues dans l'environnement à chaque appel (jamais dans le code). Absentes ou mode illisible : null.
function lireConfigMaishaPay(source: Record<string, string | undefined> = process.env): ConfigMaishaPay | null {
  const clePublique = source.MAISHAPAY_PUBLIC_KEY?.trim();
  const cleSecrete = source.MAISHAPAY_SECRET_KEY?.trim();
  const mode = source.MAISHAPAY_GATEWAY_MODE?.trim();
  if (!clePublique || !cleSecrete || (mode !== "0" && mode !== "1")) return null;
  return { clePublique, cleSecrete, mode: mode === "1" ? 1 : 0 };
}

// Adaptateurs réellement écrits. Un Prestataire dont l'adaptateur n'existe pas, ou dont la documentation laisse des questions ouvertes, ne peut
// pas être activé : sans cela, le site annoncerait « Paiement traité par MaishaPay » sans aucun moyen sûr de payer (règles 13, 14 et 15).
// Chaque story d'adaptateur ajoute le sien ici : Polar (4.7), MaishaPay mobile money et carte (5.6 et 5.9), PawaPay (5.7). K-Pay et GeniusPay sont
// abandonnés. Aucun adaptateur de test n'entre jamais dans cette liste.
const ADAPTATEURS: Partial<Record<CodePrestataire, PrestatairePaiement>> = {
  maishapay: creerAdaptateurMaishaPay(lireConfigMaishaPay),
};

// Adaptateurs activables : écrits ET sans question ouverte. Seuls ceux-là sont proposés au client et peuvent être activés dans l'admin.
export const ADAPTATEURS_BRANCHES: ReadonlySet<CodePrestataire> = new Set(
  (Object.keys(ADAPTATEURS) as CodePrestataire[]).filter((code) => (ADAPTATEURS[code]?.questionsOuvertes.length ?? 1) === 0),
);

export function adaptateurBranche(code: CodePrestataire, branches: ReadonlySet<CodePrestataire> = ADAPTATEURS_BRANCHES): boolean {
  return branches.has(code);
}

// Adaptateur écrit, activable ou non : les notifications et la réconciliation doivent pouvoir aboutir même après une désactivation.
export function lireAdaptateur(code: CodePrestataire): PrestatairePaiement | null {
  return ADAPTATEURS[code] ?? null;
}

// Questions ouvertes d'un adaptateur écrit mais non activable (pour l'admin) ; vide si l'adaptateur est activable ou absent.
export function questionsOuvertes(code: CodePrestataire): readonly string[] {
  return ADAPTATEURS[code]?.questionsOuvertes ?? [];
}
