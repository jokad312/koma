import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { alternatives, urlLocalisee } from "@/lib/seo/url";
import { PAGES_LEGALES } from "@/lib/vitrine/pages-legales";
import { lireSlugsPublies } from "@/modules/catalogue/queries";
import type { FamilleProduit } from "@/modules/catalogue/types";

// Pages publiques existantes, en deux langues. Admin, compte et /api n'y figurent jamais.
// Les catalogues sont donnés par leur dossier interne : l'adresse de chaque langue vient de src/i18n/adresses.ts.
const PAGES_PUBLIQUES = ["", "/cosplays", "/accessoires", "/a-propos", "/faq", "/contact", ...PAGES_LEGALES.map((p) => p.chemin)];

const DOSSIER_FICHE: Record<FamilleProduit, string> = { cosplay: "/cosplays", accessoire: "/accessoires", kit: "/kits" };

function entrees(chemins: readonly string[]): MetadataRoute.Sitemap {
  return chemins.flatMap((chemin) =>
    routing.locales.map((locale) => ({
      url: urlLocalisee(locale, chemin),
      alternates: { languages: alternatives(chemin) },
    })),
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statiques = entrees(PAGES_PUBLIQUES);
  // Fiches publiées (lecture publique, RLS) : en cas d'échec de lecture, le plan garde les pages statiques et les catalogues, et l'erreur est journalisée.
  try {
    const produits = await lireSlugsPublies();
    return [...statiques, ...entrees(produits.map((p) => `${DOSSIER_FICHE[p.famille]}/${p.slug}`))];
  } catch {
    console.error("[plan du site] lecture des fiches publiées impossible : fiches absentes du plan");
    return statiques;
  }
}
