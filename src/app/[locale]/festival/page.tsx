import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ListeEvenements } from "@/components/festival/ListeEvenements";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { Squelette } from "@/components/ui/Squelette";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { analyserRequeteEvenements } from "@/modules/evenements/adresse";
import { listerEvenementsPublies } from "@/modules/evenements/queries-publiques";

type Props = PageProps<"/[locale]/festival">;

// Métadonnées de la liste : la première page est indexable avec sa canonique ; une page à nombre valide (?affiches=) est noindex, follow,
// sans canonique. Un nombre illisible affiche la première page. Titre et description reprennent le nom de la rubrique : aucun texte inventé.
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Navigation.rubriques" });
  const affiches = analyserRequeteEvenements(await searchParams);
  return construireMetadata({
    locale,
    chemin: "/festival",
    titre: t("festival"),
    description: t("festival"),
    nomSite: await lireNomSite(),
    indexable: affiches === null,
    suivreLesLiens: true,
    sansCanonique: affiches !== null,
  });
}

// Titre fixe ; la liste dépend de l'adresse (?affiches=) et se prépare donc derrière un Suspense : la coque reste prérendue.
export default async function Festival({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Festival" });

  return (
    <section className="flex flex-col gap-6">
      <TitreVitrine niveau={1}>{t("titre")}</TitreVitrine>
      <Suspense fallback={<Squelette className="h-96 w-full" />}>
        <ContenuFestival locale={locale} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function ContenuFestival({ locale, searchParams }: { locale: "fr" | "en"; searchParams: Props["searchParams"] }) {
  const t = await getTranslations({ locale, namespace: "Festival" });
  const affiches = analyserRequeteEvenements(await searchParams);
  let page;
  try {
    page = await listerEvenementsPublies(locale, affiches ?? 0, { cumul: true });
  } catch {
    // Jamais une liste inventée : message sobre, rien d'autre sur la page.
    console.error("[festival] lecture impossible");
    return <MessageEtat type="erreur">{t("erreur")}</MessageEtat>;
  }
  return <ListeEvenements cle={`${affiches ?? "debut"}|${page.evenements[0]?.id ?? "aucun"}`} evenements={page.evenements} suite={page.suite} />;
}
