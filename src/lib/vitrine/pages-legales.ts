// Pages légales : liste unique (clé de messages, chemin, clés de métadonnées et de pied) utilisée par les pages, le pied de page et le sitemap.
// Aucun texte légal ici : corps et date de version viennent de messages/*.json (Legal.<cle>.texte et Legal.<cle>.version).
export const PAGES_LEGALES = [
  { cle: "mentions", chemin: "/mentions-legales" },
  { cle: "cgv", chemin: "/cgv" },
  { cle: "livraison", chemin: "/livraison-et-retours" },
  { cle: "confidentialite", chemin: "/confidentialite" },
] as const;

export type ClePageLegale = (typeof PAGES_LEGALES)[number]["cle"];

// Le texte est découpé sur les lignes vides ; les paragraphes vides sont ignorés.
export function decouperParagraphes(texte: string): string[] {
  return texte
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

// Version : date ISO AAAA-MM-JJ valide formatée selon la langue (attribut datetime fourni) ; sinon valeur affichée telle quelle.
export function formaterVersion(version: string, locale: string): { texte: string; iso: string | null } {
  const m = DATE_ISO.exec(version.trim());
  if (m) {
    const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(annee, mois - 1, jour));
    if (date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour) {
      const texte = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
      return { texte, iso: version.trim() };
    }
  }
  return { texte: version.trim(), iso: null };
}
