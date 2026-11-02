"use server";

import { decoderCurseurArticles } from "./adresse";
import { listerArticlesPublies } from "./queries";
import type { CarteArticle } from "./types";

// Action du bouton « Voir plus » : les 12 Articles suivants. Le curseur et la langue viennent du navigateur et sont revalidés ici ;
// un curseur illisible est refusé, jamais deviné. Une erreur de lecture rend ok: false (l'interface garde le lien et affiche l'erreur).
export type ResultatVoirPlusArticles = { ok: true; articles: CarteArticle[]; suite: string | null } | { ok: false };

export async function chargerPlusArticles(curseur: string, locale: string): Promise<ResultatVoirPlusArticles> {
  if (locale !== "fr" && locale !== "en") return { ok: false };
  if (typeof curseur !== "string" || curseur.length > 200 || curseur === "") return { ok: false };
  const decode = decoderCurseurArticles(curseur);
  if (!decode) return { ok: false };
  try {
    // La page à curseur relit depuis le début (cumul) : la suite affichée est exactement la même que celle d'un rechargement.
    const page = await listerArticlesPublies(locale, decode, { cumul: true });
    return { ok: true, articles: page.articles.slice(decode.n), suite: page.suite };
  } catch {
    console.error("[blog] voir plus : lecture impossible");
    return { ok: false };
  }
}
