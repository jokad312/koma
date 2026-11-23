import { lireEnvPublique } from "@/lib/env";
import { cheminPublic } from "@/i18n/adresses";
import { LANGUES_ACTIVES, PLUSIEURS_LANGUES, routing, type Locale } from "@/i18n/routing";

// Adresse du site : NEXT_PUBLIC_SITE_URL seulement, sans barre finale.
export function adresseSite(): string {
  return lireEnvPublique().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
}

// Chemin localisé : ("fr", "") donne "/fr" ; ("en", "/faq") donne "/en/faq" ; ("en", "/accessoires") donne "/en/accessories"
// (le chemin passé est celui du dossier de l'application, l'adresse rendue est celle de la langue : AD-16).
export function cheminLocalise(locale: Locale, chemin = ""): string {
  const propre = chemin === "/" ? "" : chemin;
  return `/${locale}${cheminPublic(locale, propre)}`;
}

// `requete` (sans « ? ») est ajoutée telle quelle : curseur d'une page de catalogue indexable.
export function urlLocalisee(locale: Locale, chemin = "", requete = ""): string {
  return `${adresseSite()}${cheminLocalise(locale, chemin)}${requete ? `?${requete}` : ""}`;
}

// hreflang : une entrée par langue disponible et active, x-default vers la langue par défaut quand elle fait partie des versions servies.
// Une seule langue active (site en français uniquement depuis le 2026-11-22) : aucun hreflang, objet vide.
export function alternatives(chemin = "", requete = "", langues: readonly Locale[] = routing.locales): Record<string, string> {
  if (!PLUSIEURS_LANGUES) return {};
  const servies = routing.locales.filter((l) => langues.includes(l) && (LANGUES_ACTIVES as readonly Locale[]).includes(l));
  const entrees = Object.fromEntries(servies.map((l) => [l, urlLocalisee(l, chemin, requete)]));
  if (!servies.includes(routing.defaultLocale)) return entrees;
  return { ...entrees, "x-default": urlLocalisee(routing.defaultLocale, chemin, requete) };
}
