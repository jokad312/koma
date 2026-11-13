import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CarteArticle } from "@/components/blog/CarteArticle";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import type { Locale } from "@/i18n/routing";
import { lireDerniersArticles } from "@/modules/blog/queries";
import type { CarteArticle as Donnees } from "@/modules/blog/types";

const NB_ARTICLES_GUIDES = 3;

// Bloc 7 « Guides » de l'accueil : les trois derniers Articles publiés. Aucun Article ou lecture en erreur : le bloc n'existe pas
// (aucun titre, aucun espace), jamais une carte inventée. Pas de lien « Voir tous » (décision de la story 8.7).
export async function BlocGuides({ locale, niveau = 2 }: { locale: Locale; niveau?: 2 | 3 }) {
  // Attend la vraie requête : pendant le prérendu de la coque, Next.js annulerait la lecture et le bloc serait figé « absent ».
  await connection();
  let articles: Donnees[];
  try {
    articles = await lireDerniersArticles(locale, NB_ARTICLES_GUIDES);
  } catch (e) {
    // Les signaux internes de Next.js (rendu dynamique, redirection) doivent remonter ; toute autre erreur masque le bloc.
    unstable_rethrow(e);
    console.error("[accueil] lecture des derniers articles impossible :", e instanceof Error ? `${e.name} ${e.message}` : "erreur inconnue");
    return null;
  }
  if (articles.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "Accueil.bloc7" });

  return (
    <section aria-labelledby="accueil-guides" className="flex flex-col gap-4">
      <div id="accueil-guides">
        <TitreVitrine niveau={niveau}>{t("titre")}</TitreVitrine>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {articles.map((article) => (
          <li key={article.id}>
            <CarteArticle article={article} niveau={niveau === 2 ? 3 : 4} />
          </li>
        ))}
      </ul>
    </section>
  );
}
