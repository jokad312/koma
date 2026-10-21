import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  // Le cookie est écrit par le sélecteur de langue (story 1.3) ; la 1.2 le lit seulement.
  localeCookie: false,
  localeDetection: false,
  // Les hreflang viennent des metadata (NEXT_PUBLIC_SITE_URL), pas de l'en-tête Link.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];

export const NOM_COOKIE_LANGUE = "NEXT_LOCALE";
