import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { metadataCatalogue, PageCatalogue } from "@/components/catalogue/PageCatalogue";
import { routing } from "@/i18n/routing";

// Adresse publique : /fr/vetements et /en/clothing (src/i18n/adresses.ts) ; ce dossier sert les deux langues.
export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/vetements">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return metadataCatalogue({ famille: "vetement", locale, searchParams });
}

export default async function Vetements({ params, searchParams }: PageProps<"/[locale]/vetements">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageCatalogue famille="vetement" locale={locale} searchParams={searchParams} />;
}
