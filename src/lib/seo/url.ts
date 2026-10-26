import { lireEnvPublique } from "@/lib/env";
import { cheminPublic } from "@/i18n/adresses";
import { routing, type Locale } from "@/i18n/routing";

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

// hreflang : une entrée par langue, x-default vers la langue par défaut (/fr).
export function alternatives(chemin = "", requete = ""): Record<string, string> {
  const langues = Object.fromEntries(routing.locales.map((l) => [l, urlLocalisee(l, chemin, requete)]));
  return { ...langues, "x-default": urlLocalisee(routing.defaultLocale, chemin, requete) };
}
