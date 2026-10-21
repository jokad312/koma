import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { adresseSite, alternatives, urlLocalisee } from "./url";

type Entree = {
  locale: Locale;
  chemin?: string;
  titre: string;
  description: string;
  nomSite: string;
  indexable?: boolean;
};

const LOCALE_OG: Record<Locale, string> = { fr: "fr_FR", en: "en_US" };

// Titre, description, canonique, hreflang et Open Graph d'une page publique.
export function construireMetadata({ locale, chemin = "", titre, description, nomSite, indexable = true }: Entree): Metadata {
  const titreComplet = `${titre} | ${nomSite}`;
  const url = urlLocalisee(locale, chemin);
  return {
    metadataBase: new URL(adresseSite()),
    title: titreComplet,
    description,
    alternates: { canonical: url, languages: alternatives(chemin) },
    openGraph: {
      type: "website",
      title: titreComplet,
      description,
      url,
      siteName: nomSite,
      locale: LOCALE_OG[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => LOCALE_OG[l]),
    },
    robots: indexable ? undefined : { index: false, follow: false },
  };
}
