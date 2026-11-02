import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { alternatives, urlLocalisee } from "@/lib/seo/url";
import { PAGES_LEGALES } from "@/lib/vitrine/pages-legales";
import { lireSlugsArticlesPublies } from "@/modules/blog/queries";
import { lireSlugsPublies } from "@/modules/catalogue/queries";
import type { FamilleProduit } from "@/modules/catalogue/types";

// Pages publiques existantes, en deux langues. Admin, compte et /api n'y figurent jamais.
// Les catalogues sont donnés par leur dossier interne : l'adresse de chaque langue vient de src/i18n/adresses.ts.
const PAGES_PUBLIQUES = ["", "/cosplays", "/accessoires", "/kits", "/blog", "/a-propos", "/faq", "/contact", ...PAGES_LEGALES.map((p) => p.chemin)];

// Fiches des produits publiés : cosplays, accessoires et Kits (story 3.3).
const DOSSIER_FICHE: Record<FamilleProduit, string> = { cosplay: "/cosplays", accessoire: "/accessoires", kit: "/kits" };

function entrees(chemins: readonly string[]): MetadataRoute.Sitemap {
  return chemins.flatMap((chemin) =>
    routing.locales.map((locale) => ({
      url: urlLocalisee(locale, chemin),
      alternates: { languages: alternatives(chemin) },
    })),
  );
}

// Articles publiés : le français toujours, l'anglais seulement quand la version anglaise existe (mêmes règles que la page).
// hreflang limité aux versions servies : un Article sans version anglaise n'annonce qu'une adresse française.
function entreesArticles(articles: ReadonlyArray<{ slug: string; versionAnglaise: boolean }>): MetadataRoute.Sitemap {
  return articles.flatMap((article) => {
    const chemin = `/blog/${article.slug}`;
    const langues = article.versionAnglaise ? (["fr", "en"] as const) : (["fr"] as const);
    const alternates = { languages: alternatives(chemin, "", langues) };
    return [
      { url: urlLocalisee("fr", chemin), alternates },
      ...(article.versionAnglaise ? [{ url: urlLocalisee("en", chemin), alternates }] : []),
    ];
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statiques = entrees(PAGES_PUBLIQUES);
  // Fiches publiées (lecture publique, RLS) : en cas d'échec de lecture, le plan garde les pages statiques et les catalogues, et l'erreur est journalisée.
  let fiches: MetadataRoute.Sitemap = [];
  try {
    const produits = await lireSlugsPublies();
    fiches = entrees(produits.map((p) => `${DOSSIER_FICHE[p.famille]}/${p.slug}`));
  } catch {
    console.error("[plan du site] lecture des fiches publiées impossible : fiches absentes du plan");
  }
  // Articles publiés : même principe, l'échec n'empêche pas le reste du plan.
  let articles: MetadataRoute.Sitemap = [];
  try {
    articles = entreesArticles(await lireSlugsArticlesPublies());
  } catch {
    console.error("[plan du site] lecture des articles publiés impossible : articles absents du plan");
  }
  return [...statiques, ...fiches, ...articles];
}
