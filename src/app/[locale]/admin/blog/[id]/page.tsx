import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { FormulaireArticle } from "@/components/admin/FormulaireArticle";
import { PublicationArticle } from "@/components/admin/PublicationArticle";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireArticleAdmin } from "@/modules/blog/queries";
import type { Article, ProduitLien } from "@/modules/blog/types";
import { lireProduitsAdmin } from "@/modules/catalogue/queries";

// Les identifiants d'articles ne sont connus qu'à la requête. Un seul exemplaire, jamais un vrai article (la page lit la base
// sous Suspense et rend 404 pour un identifiant inconnu), permet à Next.js de préparer la coque statique de la route.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "00000000-0000-4000-8000-000000000000" }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/blog/[id]">): Promise<Metadata> {
  // Seule la langue est lue : l'identifiant est une donnée de requête, lue sous Suspense dans la page.
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({
    locale,
    chemin: "/admin/blog",
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

// Droit vérifié sur la page elle-même, puis lecture de l'article et des produits. Identifiant inconnu ou mal formé : 404.
async function ArticleSelonDroit({
  locale,
  id,
  searchParams,
}: {
  locale: Locale;
  id: string;
  searchParams: PageProps<"/[locale]/admin/blog/[id]">["searchParams"];
}) {
  await exigerAdminPage(locale, `/admin/blog/${id}`, "blog.gerer");
  const { cree: crees } = await searchParams;
  const cree = (Array.isArray(crees) ? crees[0] : crees) === "1";
  const t = await getTranslations("Admin.blog");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  let article: Article | null = null;
  let produits: ProduitLien[] | null = null;
  let lecture = true;
  try {
    const [lu, liste] = await Promise.all([lireArticleAdmin(id), lireProduitsAdmin()]);
    article = lu;
    produits = liste.map((p) => ({ id: p.id, titreFr: p.titreFr }));
  } catch {
    lecture = false;
    console.error("[blog] lecture de l'article impossible");
  }
  if (lecture && !article) notFound();
  return (
    <CoqueAdmin>
      <div className="flex flex-col gap-6">
        <h1 className="t-h1">{t("pageEdition.titre")}</h1>
        <p>
          <Link href="/admin/blog" className="t-label inline-flex min-h-touch items-center underline">
            {t("pageEdition.retour")}
          </Link>
        </p>
        {cree ? <MessageEtat type="succes">{t("pageEdition.cree")}</MessageEtat> : null}
        {article && produits ? (
          <>
            <FormulaireArticle article={article} produits={produits} />
            <PublicationArticle articleId={article.id} publie={article.publieLe !== null} />
          </>
        ) : (
          <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>
        )}
      </div>
    </CoqueAdmin>
  );
}

export default async function ArticleAEditer({ params, searchParams }: PageProps<"/[locale]/admin/blog/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <ArticleSelonDroit locale={locale} id={id} searchParams={searchParams} />
    </Suspense>
  );
}
