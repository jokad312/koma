// Marqueur des textes que Jonathan doit encore fournir (À propos, FAQ, et plus tard les pages légales).
// Seule source dans le code. Ce fichier n'utilise que de la syntaxe TypeScript effaçable : scripts/verifier-marqueurs.mjs l'importe tel quel.
export const MARQUEUR_TEXTE = "[Texte à fournir]";

// Espaces de noms de messages/*.json des pages publiques : un marqueur ici fait échouer le build de production.
// Liste unique (Legal : pages légales, story 1.9).
export const ESPACES_PUBLICS: readonly string[] = ["APropos", "Faq", "Contact", "Legal", "Accueil"];

export function contientMarqueur(texte: string): boolean {
  return texte.includes(MARQUEUR_TEXTE);
}

// Clés (« Espace.chemin.cle ») des textes qui contiennent le marqueur, pour les espaces donnés.
export function trouverMarqueurs(messages: unknown, espaces: readonly string[] = ESPACES_PUBLICS): string[] {
  const trouves: string[] = [];
  const parcourir = (valeur: unknown, chemin: string) => {
    if (typeof valeur === "string") {
      if (contientMarqueur(valeur)) trouves.push(chemin);
    } else if (valeur !== null && typeof valeur === "object") {
      for (const [cle, enfant] of Object.entries(valeur)) parcourir(enfant, `${chemin}.${cle}`);
    }
  };
  const racine = (messages ?? {}) as Record<string, unknown>;
  for (const espace of espaces) {
    if (espace in racine) parcourir(racine[espace], espace);
  }
  return trouves;
}
