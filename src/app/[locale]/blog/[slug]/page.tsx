import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { ArticleComplet } from "@/components/blog/ArticleComplet";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireArticlePublie } from "@/modules/blog/queries";
import { extraireTexte } from "@/modules/blog/texte";

type Props = PageProps<"/[locale]/blog/[slug]">;

// Adresse dynamique (l'Article est lu à chaque requête) : la route est rendue à la demande, ce qui permet une vraie 404.
export const instant = false;

// Une seule lecture par requête, partagée par les métadonnées et la page.
const lireArticle = cache(lireArticlePublie);

// Titre, description (extrait du texte), première image en Open Graph, hreflang limité aux versions réellement servies.
// Article inconnu, en brouillon, dépublié ou sans version anglaise sous /en : 404. Lecture impossible : page non indexée.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  let article;
  try {
    article = await lireArticle(locale, slug);
  } catch {
    console.error("[blog] lecture impossible");
    return { robots: { index: false, follow: false } };
  }
  if (!article) notFound();
  const premiere = article.images[0];
  return construireMetadata({
    locale,
    chemin: `/blog/${slug}`,
    titre: article.titre,
    description: extraireTexte(article.texte) ?? article.titre,
    nomSite: await lireNomSite(),
    languesDisponibles: article.versionAnglaise ? ["fr", "en"] : ["fr"],
    ...(premiere ? { image: { url: premiere.url, alt: premiere.alt } } : {}),
  });
}

export default async function PageArticle({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Blog" });

  let article;
  try {
    article = await lireArticle(locale, slug);
  } catch {
    // Jamais une page inventée : message sobre, rien d'autre sur la page.
    console.error("[blog] lecture impossible");
    return <MessageEtat type="erreur">{t("erreur")}</MessageEtat>;
  }
  if (!article) notFound();

  return <ArticleComplet article={article} locale={locale} nomSite={await lireNomSite()} />;
}
