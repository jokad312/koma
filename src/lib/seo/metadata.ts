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
  // Page non indexée dont les liens restent suivis (catalogue filtré ou trié) ; sans effet si la page est indexable.
  suivreLesLiens?: boolean;
  // Requête (sans « ? ») qui fait partie de l'adresse canonique (curseur d'un catalogue indexable).
  requete?: string;
  // Image de partage (URL absolue) et son texte alternatif : Open Graph et carte Twitter grande image.
  image?: { url: string; alt: string };
};

const LOCALE_OG: Record<Locale, string> = { fr: "fr_FR", en: "en_US" };

// Titre, description, canonique, hreflang et Open Graph d'une page publique.
export function construireMetadata({ locale, chemin = "", titre, description, nomSite, indexable = true, suivreLesLiens = false, requete = "", image }: Entree): Metadata {
  const titreComplet = `${titre} | ${nomSite}`;
  const url = urlLocalisee(locale, chemin, requete);
  return {
    metadataBase: new URL(adresseSite()),
    title: titreComplet,
    description,
    alternates: { canonical: url, languages: alternatives(chemin, requete) },
    openGraph: {
      type: "website",
      title: titreComplet,
      description,
      url,
      siteName: nomSite,
      locale: LOCALE_OG[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => LOCALE_OG[l]),
      ...(image ? { images: [{ url: image.url, alt: image.alt }] } : {}),
    },
    ...(image ? { twitter: { card: "summary_large_image" as const, title: titreComplet, description, images: [{ url: image.url, alt: image.alt }] } } : {}),
    robots: indexable ? undefined : { index: false, follow: suivreLesLiens },
  };
}
