import { creerAdaptateurPawaPay, type ConfigPawaPay } from "./adaptateurs/pawapay";
import { creerAdaptateurMaishaPay, type ConfigMaishaPay } from "./adaptateurs/maishapay";
import { creerAdaptateurPolar, type ConfigPolar } from "./adaptateurs/polar";
import type { CodePrestataire, PrestatairePaiement } from "./types";

// Clés de l'application dédiée au site chez MaishaPay, lues dans l'environnement à chaque appel (jamais dans le code). Absentes ou mode illisible : null.
function lireConfigMaishaPay(source: Record<string, string | undefined> = process.env): ConfigMaishaPay | null {
  const clePublique = source.MAISHAPAY_PUBLIC_KEY?.trim();
  const cleSecrete = source.MAISHAPAY_SECRET_KEY?.trim();
  const mode = source.MAISHAPAY_GATEWAY_MODE?.trim();
  if (!clePublique || !cleSecrete || (mode !== "0" && mode !== "1")) return null;
  return { clePublique, cleSecrete, mode: mode === "1" ? 1 : 0 };
}

// Jeton d'API de PawaPay et mode (bac à sable ou production, deux comptes et deux jetons distincts), lus dans l'environnement à chaque appel.
function lireConfigPawaPay(source: Record<string, string | undefined> = process.env): ConfigPawaPay | null {
  const jeton = source.PAWAPAY_API_TOKEN?.trim();
  const mode = source.PAWAPAY_MODE?.trim();
  if (!jeton || (mode !== "sandbox" && mode !== "production")) return null;
  return { jeton, production: mode === "production" };
}

// Clés de l'organisation Polar dédiée au site : jeton d'accès, serveur (sandbox ou production, deux organisations et deux jetons distincts), secret de signature
// des webhooks et produit numérique qui porte les prix ad hoc. Lues dans l'environnement à chaque appel ; une clé absente ou un serveur illisible : null.
function lireConfigPolar(source: Record<string, string | undefined> = process.env): ConfigPolar | null {
  const jeton = source.POLAR_ACCESS_TOKEN?.trim();
  const serveur = source.POLAR_SERVER?.trim();
  const secretWebhook = source.POLAR_WEBHOOK_SECRET?.trim();
  const produitId = source.POLAR_PRODUCT_ID?.trim();
  if (!jeton || !secretWebhook || !produitId || (serveur !== "sandbox" && serveur !== "production")) return null;
  return { jeton, production: serveur === "production", secretWebhook, produitId };
}

// Adaptateurs réellement écrits. Un Prestataire dont l'adaptateur n'existe pas, ou dont la documentation laisse des questions ouvertes, ne peut
// pas être activé : sans cela, le site annoncerait « Paiement traité par MaishaPay » sans aucun moyen sûr de payer (règles 13, 14 et 15).
// Chaque story d'adaptateur ajoute le sien ici : Polar (4.7), MaishaPay mobile money et carte (5.6 et 5.9), PawaPay (5.7). K-Pay et GeniusPay sont
// abandonnés. Aucun adaptateur de test n'entre jamais dans cette liste.
const ADAPTATEURS: Partial<Record<CodePrestataire, PrestatairePaiement>> = {
  maishapay: creerAdaptateurMaishaPay(lireConfigMaishaPay),
  pawapay: creerAdaptateurPawaPay(lireConfigPawaPay),
  polar: creerAdaptateurPolar(lireConfigPolar),
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
