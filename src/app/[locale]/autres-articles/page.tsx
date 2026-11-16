import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { metadataCatalogue, PageCatalogue } from "@/components/catalogue/PageCatalogue";
import { routing } from "@/i18n/routing";

// Adresse publique : /fr/autres-articles et /en/other-items (src/i18n/adresses.ts) ; ce dossier sert les deux langues.
export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/autres-articles">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return metadataCatalogue({ famille: "autre", locale, searchParams });
}

export default async function AutresArticles({ params, searchParams }: PageProps<"/[locale]/autres-articles">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageCatalogue famille="autre" locale={locale} searchParams={searchParams} />;
}
