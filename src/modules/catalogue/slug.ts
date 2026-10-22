// Adresse (slug) d'un produit : fonctions pures, partagées par le formulaire (navigateur) et le serveur.

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX = 80;

// Proposition depuis le titre français : minuscules, sans accent, tirets, 80 caractères au plus.
export function proposerSlug(titre: string): string {
  const base = titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, SLUG_MAX).replace(/-+$/g, "");
}

// Première adresse libre : la base si elle est libre, sinon base-2, base-3, … (80 caractères au plus, suffixe compris).
export function choisirSlugLibre(base: string, pris: ReadonlySet<string>): string {
  if (!pris.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffixe = `-${n}`;
    const candidat = `${base.slice(0, SLUG_MAX - suffixe.length).replace(/-+$/g, "")}${suffixe}`;
    if (!pris.has(candidat)) return candidat;
  }
}
