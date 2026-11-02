import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ListeArticles } from "@/components/blog/ListeArticles";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { analyserRequeteArticles } from "@/modules/blog/adresse";
import { listerArticlesPublies } from "@/modules/blog/queries";

type Props = PageProps<"/[locale]/blog">;

// Métadonnées de la liste : la première page est indexable avec sa canonique ; une page à curseur valide est noindex, follow,
// sans canonique (jamais une canonique vers /blog, qui contredirait le noindex). Un curseur périmé ou illisible affiche la première page.
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.blog" });
  const curseur = analyserRequeteArticles(await searchParams);
  let curseurValide = curseur !== null;
  if (curseurValide && curseur) {
    try {
      curseurValide = (await listerArticlesPublies(locale, curseur)).articles.length > 0;
    } catch {
      curseurValide = false;
    }
  }
  return construireMetadata({
    locale,
    chemin: "/blog",
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: !curseurValide,
    suivreLesLiens: true,
    sansCanonique: curseurValide,
  });
}

// Titre et fil d'Ariane fixes ; la liste dépend de l'adresse (?curseur=) et se prépare donc derrière un Suspense,
// comme les catalogues : la coque reste prérendue, la liste est servie à la requête.
export default async function Blog({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Blog" });

  return (
    <section className="flex flex-col gap-6">
      <TitreVitrine niveau={1}>{t("titre")}</TitreVitrine>
      <Suspense fallback={<Squelette className="h-96 w-full" />}>
        <ContenuBlog locale={locale} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function ContenuBlog({ locale, searchParams }: { locale: "fr" | "en"; searchParams: Props["searchParams"] }) {
  const t = await getTranslations({ locale, namespace: "Blog" });
  const curseur = analyserRequeteArticles(await searchParams);
  let page;
  // Paramètres réellement servis : un curseur périmé (plus rien après lui) ramène à la première page.
  let servis = curseur;
  try {
    page = await listerArticlesPublies(locale, curseur, { cumul: true });
    if (page.articles.length === 0 && curseur) {
      servis = null;
      page = await listerArticlesPublies(locale, null);
    }
  } catch {
    // Jamais une liste inventée : message sobre, rien d'autre sur la page.
    console.error("[blog] lecture impossible");
    return <MessageEtat type="erreur">{t("erreur")}</MessageEtat>;
  }

  if (page.articles.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface p-5">
        <p className="t-body text-text-secondary">{t("vide")}</p>
        <Link
          href="/"
          className="t-button inline-flex min-h-touch items-center justify-center rounded-full border border-border-field bg-surface px-5 py-3 text-center text-text-primary no-underline"
        >
          {t("retourAccueil")}
        </Link>
      </div>
    );
  }

  return <ListeArticles cle={`${servis ? "curseur" : "debut"}|${page.articles[0].id}`} articles={page.articles} suite={page.suite} />;
}
