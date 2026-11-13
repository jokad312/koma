import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BlocsAccueil } from "@/components/accueil/BlocsAccueil";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.accueil" });
  return construireMetadata({ locale, titre: t("titre"), description: t("description"), nomSite: await lireNomSite() });
}

// Accueil public, le même pour tous (décision de Jonathan du 2026-11-13, option A). Le proxy n'envoie que l'admin et l'assistant vers l'admin.
export default async function Accueil({ params, searchParams }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <BlocsAccueil locale={locale} searchParams={searchParams} variante="complet" />;
}
