import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { BlocCosplaysRecents } from "@/components/accueil/BlocCosplaysRecents";
import { BlocFaqCourte } from "@/components/accueil/BlocFaqCourte";
import { BlocJonathan } from "@/components/accueil/BlocJonathan";
import { TuilesCategories } from "@/components/accueil/TuilesCategories";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
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
function rendreBloc(id: string, locale: Locale): ReactNode {
  switch (id) {
    case "categories":
      return <TuilesCategories />;
    case "cosplaysRecents":
      // Lu à chaque requête (badge de disponibilité) ; pas de repli visible : le bloc n'existe qu'une fois ses cosplays lus.
      return (
        <Suspense fallback={null}>
          <BlocCosplaysRecents locale={locale} />
        </Suspense>
      );
    case "jonathan":
      return <BlocJonathan />;
    case "faqCourte":
      return <BlocFaqCourte locale={locale} />;
    default:
      return null;
  }
}

export default async function Accueil({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Accueil");

  return (
    <div className="flex flex-col gap-10">
      <TitreVitrine niveau={1}>{t("titre")}</TitreVitrine>
      {blocsAffiches().map((bloc) => (
        <div key={bloc.id} className="contents">
          {rendreBloc(bloc.id, locale)}
        </div>
      ))}
    </div>
  );
}
