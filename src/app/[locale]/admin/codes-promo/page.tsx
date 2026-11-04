import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CodesPromoSelonDroit } from "@/components/admin/CodesPromoSelonDroit";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

const CHEMIN = "/admin/codes-promo";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/codes-promo">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.admin" });
  // Page d'administration : jamais indexée.
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

export default async function CodesPromo({ params }: PageProps<"/[locale]/admin/codes-promo">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <CodesPromoSelonDroit locale={locale} chemin={CHEMIN} />
    </Suspense>
  );
}
