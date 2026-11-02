import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { ListeArticles } from "@/components/admin/ListeArticles";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireArticlesAdmin } from "@/modules/blog/queries";
import type { ArticleListe } from "@/modules/blog/types";

const CHEMIN = "/admin/blog";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/blog">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({
    locale,
    chemin: CHEMIN,
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

// Droit vérifié sur la page elle-même (le layout ne suffit pas), puis lecture par le client service.
async function ArticlesSelonDroit({ locale }: { locale: Locale }) {
  await exigerAdminPage(locale, CHEMIN, "blog.gerer");
  const t = await getTranslations("Admin.blog");
  let articles: ArticleListe[] | null = null;
  try {
    articles = await lireArticlesAdmin();
  } catch {
    console.error("[blog] lecture des articles impossible");
  }
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        {articles && articles.length > 0 ? (
          <div>
            <Bouton href="/admin/blog/nouveau">{t("nouveau")}</Bouton>
          </div>
        ) : null}
        {articles ? <ListeArticles articles={articles} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
      </div>
    </CoqueAdmin>
  );
}

export default async function Blog({ params }: PageProps<"/[locale]/admin/blog">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <ArticlesSelonDroit locale={locale} />
    </Suspense>
  );
}
