import { lireEnvPublique } from "@/lib/env";
import { routing, type Locale } from "@/i18n/routing";

// Adresse du site : NEXT_PUBLIC_SITE_URL seulement, sans barre finale.
export function adresseSite(): string {
  return lireEnvPublique().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
}

// Chemin localisé : ("fr", "") donne "/fr" ; ("en", "/faq") donne "/en/faq".
export function cheminLocalise(locale: Locale, chemin = ""): string {
  const propre = chemin === "/" ? "" : chemin;
  return `/${locale}${propre}`;
}

export function urlLocalisee(locale: Locale, chemin = ""): string {
  return `${adresseSite()}${cheminLocalise(locale, chemin)}`;
}

// hreflang : une entrée par langue, x-default vers la langue par défaut (/fr).
export function alternatives(chemin = ""): Record<string, string> {
  const langues = Object.fromEntries(routing.locales.map((l) => [l, urlLocalisee(l, chemin)]));
  return { ...langues, "x-default": urlLocalisee(routing.defaultLocale, chemin) };
}
