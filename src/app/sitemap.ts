import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { alternatives, urlLocalisee } from "@/lib/seo/url";
import { PAGES_LEGALES } from "@/lib/vitrine/pages-legales";

// Pages publiques existantes, en deux langues. Admin, compte et /api n'y figurent jamais.
// Les catalogues sont donnés par leur dossier interne : l'adresse de chaque langue vient de src/i18n/adresses.ts.
const PAGES_PUBLIQUES = ["", "/cosplays", "/accessoires", "/a-propos", "/faq", "/contact", ...PAGES_LEGALES.map((p) => p.chemin)];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES_PUBLIQUES.flatMap((chemin) =>
    routing.locales.map((locale) => ({
      url: urlLocalisee(locale, chemin),
      alternates: { languages: alternatives(chemin) },
    })),
  );
}
