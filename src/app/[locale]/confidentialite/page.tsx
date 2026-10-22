import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageLegale } from "@/components/vitrine/PageLegale";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

const CHEMIN = "/confidentialite";

export async function generateMetadata({ params }: PageProps<"/[locale]/confidentialite">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.legal" });
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("confidentialite.titre"), description: t("confidentialite.description"), nomSite: await lireNomSite() });
}

export default async function Page({ params }: PageProps<"/[locale]/confidentialite">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageLegale locale={locale} cle="confidentialite" />;
}
