import { NOM_COOKIE_LANGUE, type Locale } from "@/i18n/routing";

const UN_AN = 60 * 60 * 24 * 365;

// Écrit par le sélecteur de langue ; lu par le proxy pour choisir la langue de « / ».
export function formaterCookieLangue(locale: Locale): string {
  return `${NOM_COOKIE_LANGUE}=${locale}; path=/; max-age=${UN_AN}; samesite=lax`;
}

export function ecrireCookieLangue(locale: Locale): void {
  document.cookie = formaterCookieLangue(locale);
}
