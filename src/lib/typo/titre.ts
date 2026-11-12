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

// Sakura Town n'a aucun accent : quand elle est active, le titre est écrit sans accents (« CATÉGORIES » devient « CATEGORIES »).
// Avec Barlow Condensed (Sakura éteinte, ou titre qu'elle ne couvre pas même sans accents), le titre garde ses accents.
export function retirerAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function preparerTitre(texte: string, sakuraActive: boolean): { texte: string; police: PoliceTitre } {
  if (sakuraActive) {
    const sansAccents = retirerAccents(texte);
    if (sakuraCouvre(sansAccents)) return { texte: sansAccents, police: "sakura" };
  }
  return { texte, police: "condensee" };
}
