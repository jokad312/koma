// Choix de la police d'un grand titre de vitrine (UX-DR4).
// Sakura Town couvre les caractères ASCII imprimables (U+0020 à U+007E) : aucun accent, aucun « ’ », aucun guillemet français.
// Un seul caractère absent bascule le titre ENTIER en Barlow Condensed : jamais de mélange dans un titre.

const PREMIER = 0x20;
const DERNIER = 0x7e;

export const GLYPHES_SAKURA: string = Array.from({ length: DERNIER - PREMIER + 1 }, (_, i) => String.fromCharCode(PREMIER + i)).join("");

export type PoliceTitre = "sakura" | "condensee";

export function sakuraCouvre(texte: string): boolean {
  for (const caractere of texte) {
    const code = caractere.codePointAt(0) ?? 0;
    if (code < PREMIER || code > DERNIER) return false;
  }
  return true;
}

export function choisirPoliceTitre(texte: string, sakuraActive: boolean): PoliceTitre {
  return sakuraActive && sakuraCouvre(texte) ? "sakura" : "condensee";
}
