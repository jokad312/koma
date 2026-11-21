import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CodesPromoSelonDroit } from "@/components/admin/CodesPromoSelonDroit";
import { Squelette } from "@/components/ui/Squelette";
import { routing, type Locale } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

const CHEMIN = "/admin/codes-promo";

// Rendue à la demande : filtre, recherche, page et fenêtre sont lus dans l'adresse (la non-indexation vient de generateMetadata).
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/codes-promo">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function Contenu({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[locale]/admin/codes-promo">["searchParams"] }) {
  return <CodesPromoSelonDroit locale={locale} chemin={CHEMIN} recherche={await searchParams} />;
}

export default async function CodesPromo({ params, searchParams }: PageProps<"/[locale]/admin/codes-promo">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <Contenu locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}
