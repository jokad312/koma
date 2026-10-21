import { routing, type Locale } from "./routing";

function estLocale(valeur: string | undefined | null): valeur is Locale {
  return !!valeur && (routing.locales as readonly string[]).includes(valeur);
}

// Langue de « / » : cookie valide d'abord ; sinon fr* vers fr, toute autre langue vers en ; absent ou illisible vers fr.
export function choisirLangue(cookie: string | undefined | null, acceptLanguage: string | undefined | null): Locale {
  if (estLocale(cookie)) return cookie;

  const premiere = (acceptLanguage ?? "")
    .split(",")
    .map((morceau) => {
      const [etiquette, ...params] = morceau.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const poids = q ? Number(q.slice(2)) : 1;
      return { etiquette: etiquette.trim().toLowerCase(), poids: Number.isFinite(poids) ? poids : 0 };
    })
    .filter((l) => /^[a-z]{2,3}(-[a-z0-9]+)*$/.test(l.etiquette) && l.poids > 0)
    .sort((a, b) => b.poids - a.poids)[0];

  if (!premiere) return routing.defaultLocale;
  return premiere.etiquette === "fr" || premiere.etiquette.startsWith("fr-") ? "fr" : "en";
}
