import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { alternatives, urlLocalisee } from "@/lib/seo/url";

// Pages publiques existantes, en deux langues. Admin, compte et /api n'y figurent jamais.
const PAGES_PUBLIQUES = ["", "/a-propos", "/faq", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES_PUBLIQUES.flatMap((chemin) =>
    routing.locales.map((locale) => ({
      url: urlLocalisee(locale, chemin),
      alternates: { languages: alternatives(chemin) },
    })),
  );
}
