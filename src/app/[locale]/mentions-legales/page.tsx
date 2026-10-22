import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageLegale } from "@/components/vitrine/PageLegale";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

const CHEMIN = "/mentions-legales";

export async function generateMetadata({ params }: PageProps<"/[locale]/mentions-legales">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.legal" });
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("mentions.titre"), description: t("mentions.description"), nomSite: await lireNomSite() });
}

export default async function Page({ params }: PageProps<"/[locale]/mentions-legales">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageLegale locale={locale} cle="mentions" />;
}
