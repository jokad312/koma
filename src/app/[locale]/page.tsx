import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { BlocCosplaysRecents } from "@/components/accueil/BlocCosplaysRecents";
import { BlocFaqCourte } from "@/components/accueil/BlocFaqCourte";
import { BlocGuides } from "@/components/accueil/BlocGuides";
import { BlocKits } from "@/components/accueil/BlocKits";
import { BlocMur } from "@/components/accueil/BlocMur";
import { BlocRendezVous } from "@/components/accueil/BlocRendezVous";
import { BlocPorteOuFabrique } from "@/components/accueil/BlocPorteOuFabrique";
import { HerosAccueil } from "@/components/accueil/HerosAccueil";
import { BlocJonathan } from "@/components/accueil/BlocJonathan";
import { TuilesCategories } from "@/components/accueil/TuilesCategories";
import { routing, type Locale } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { blocsAffiches } from "@/modules/accueil/blocs";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.accueil" });
  return construireMetadata({ locale, titre: t("titre"), description: t("description"), nomSite: await lireNomSite() });
}

// Rendu de chaque bloc affiché. L'ordre et les emplacements réservés (rien à rendre) viennent de src/modules/accueil/blocs.ts.
function rendreBloc(id: string, locale: Locale, requete: Promise<Record<string, string | string[] | undefined>>): ReactNode {
  switch (id) {
    case "heros":
      // Accroche (H1) dans la coque statique ; vedette, photo et vidéo lues à chaque requête.
      return <HerosAccueil locale={locale} />;
    case "categories":
      return <TuilesCategories />;
    case "porteOuFabrique":
      // Bloc 1 « Porte-le ou fabrique-le » : le Cosplay vedette porté et son Kit lié, deux colonnes ; masqué sans Kit publié (FR-2).
      return (
        <Suspense fallback={null}>
          <BlocPorteOuFabrique locale={locale} />
        </Suspense>
      );
    case "kits":
      // Les Kits publiés, le Kit gratuit en évidence ; le bloc se masque sans Kit publié (FR-2).
      return (
        <Suspense fallback={null}>
          <BlocKits locale={locale} />
        </Suspense>
      );
    case "cosplaysRecents":
      // Lu à chaque requête (badge de disponibilité) ; pas de repli visible : le bloc n'existe qu'une fois ses cosplays lus.
      return (
        <Suspense fallback={null}>
          <BlocCosplaysRecents locale={locale} />
        </Suspense>
      );
    case "galerie":
      // Bloc 4 « Ils le portent » : le mur public des photos et Réalisations validées ; masqué sans photo publiée.
      return (
        <Suspense fallback={null}>
          <BlocMur locale={locale} requete={requete} />
        </Suspense>
      );
    case "rendezVousOtaku":
      // Bloc 5 « Rendez-vous otaku » : le prochain Événement à venir ; masqué sans Événement à venir ou si la lecture échoue (FR-2).
      return (
        <Suspense fallback={null}>
          <BlocRendezVous locale={locale} />
        </Suspense>
      );
    case "jonathan":
      return <BlocJonathan />;
    case "bloc7":
      // Bloc « Guides » : lu à chaque requête ; masqué sans Article publié.
      return (
        <Suspense fallback={null}>
          <BlocGuides locale={locale} />
        </Suspense>
      );
    case "faqCourte":
      return <BlocFaqCourte locale={locale} />;
    default:
      return null;
  }
}

export default async function Accueil({ params, searchParams }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <div className="flex flex-col gap-10">
      {blocsAffiches().map((bloc) => (
        <div key={bloc.id} className="contents">
          {rendreBloc(bloc.id, locale, searchParams)}
        </div>
      ))}
    </div>
  );
}
