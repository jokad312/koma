import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CoqueAdmin } from "@/components/admin/CoqueAdmin";
import { ListeArticles } from "@/components/admin/ListeArticles";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { exigerAdminPage } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { lireArticlesAdmin } from "@/modules/blog/queries";
import { FILTRES_ARTICLES, type ArticleListe, type FiltreArticles } from "@/modules/blog/types";

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

// Filtre de l'adresse (?filtre=publies…) : une valeur inconnue revient à « tous », jamais une erreur.
function lireFiltre(brut: string | string[] | undefined): FiltreArticles {
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  return (FILTRES_ARTICLES as readonly string[]).includes(valeur ?? "") ? (valeur as FiltreArticles) : "tous";
}

// Droit vérifié sur la page elle-même (le layout ne suffit pas), puis lecture par le client service.
async function ArticlesSelonDroit({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[locale]/admin/blog">["searchParams"] }) {
  const { auteur } = await exigerAdminPage(locale, CHEMIN, "blog.gerer");
  // Publier, dépublier, archiver et restaurer sont réservés à l'Admin en base (exiger_admin) : rôle relu côté serveur, jamais par le navigateur.
  const peutPublier = auteur.role === "admin";
  const filtre = lireFiltre((await searchParams).filtre);
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
        <h1 className="t-h1 uppercase">{t("titre")}</h1>
        <p className="t-body text-text-secondary">{t("intro")}</p>
        {articles ? <ListeArticles articles={articles} filtreInitial={filtre} peutPublier={peutPublier} /> : <MessageEtat type="erreur">{t("erreurLecture")}</MessageEtat>}
      </div>
    </CoqueAdmin>
  );
}

export default async function Blog({ params, searchParams }: PageProps<"/[locale]/admin/blog">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <ArticlesSelonDroit locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}
