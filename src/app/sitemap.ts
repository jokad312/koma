import type { MetadataRoute } from "next";
import { estLangueActive, LANGUES_ACTIVES } from "@/i18n/routing";
import { alternatives, urlLocalisee } from "@/lib/seo/url";
import { PAGES_LEGALES } from "@/lib/vitrine/pages-legales";
import { lireSlugsArticlesPublies } from "@/modules/blog/queries";
import { lireSlugsPublies } from "@/modules/catalogue/queries";
import { DOSSIER_PAR_FAMILLE, FAMILLES_PRODUIT } from "@/modules/catalogue/types";

// Pages publiques existantes, dans chaque langue active (français seulement depuis le 2026-11-22 : aucune adresse /en). Admin, compte et /api n'y figurent jamais.
// Les catalogues sont donnés par leur dossier interne : l'adresse de chaque langue vient de src/i18n/adresses.ts.
const PAGES_PUBLIQUES = ["", ...FAMILLES_PRODUIT.map((f) => DOSSIER_PAR_FAMILLE[f]), "/blog", "/a-propos", "/faq", "/contact", ...PAGES_LEGALES.map((p) => p.chemin)];

// Fiches des produits publiés : toutes les familles (story 3.3, story 9.15), dossiers de DOSSIER_PAR_FAMILLE.
const DOSSIER_FICHE = DOSSIER_PAR_FAMILLE;

// hreflang seulement quand plusieurs versions sont servies (aucun avec une seule langue active).
function alternatesDe(chemin: string, langues?: readonly ("fr" | "en")[]): Pick<MetadataRoute.Sitemap[number], "alternates"> {
  const languages = langues ? alternatives(chemin, "", langues) : alternatives(chemin);
  return Object.keys(languages).length > 0 ? { alternates: { languages } } : {};
}

function entrees(chemins: readonly string[]): MetadataRoute.Sitemap {
  return chemins.flatMap((chemin) =>
    LANGUES_ACTIVES.map((locale) => ({
      url: urlLocalisee(locale, chemin),
      ...alternatesDe(chemin),
    })),
  );
}

// Articles publiés : le français toujours, l'anglais seulement quand la version anglaise existe (mêmes règles que la page).
// hreflang limité aux versions servies : un Article sans version anglaise n'annonce qu'une adresse française.
function entreesArticles(articles: ReadonlyArray<{ slug: string; versionAnglaise: boolean }>): MetadataRoute.Sitemap {
  return articles.flatMap((article) => {
    const chemin = `/blog/${article.slug}`;
    const langues = article.versionAnglaise ? (["fr", "en"] as const) : (["fr"] as const);
    const alternates = alternatesDe(chemin, langues);
    return [
      { url: urlLocalisee("fr", chemin), ...alternates },
      ...(article.versionAnglaise && estLangueActive("en") ? [{ url: urlLocalisee("en", chemin), ...alternates }] : []),
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
