import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { metadataCatalogue, PageCatalogue } from "@/components/catalogue/PageCatalogue";
import { routing } from "@/i18n/routing";

// Adresse publique : /fr/accessoires et /en/accessories (src/i18n/adresses.ts) ; ce dossier sert les deux langues.
export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/accessoires">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return metadataCatalogue({ famille: "accessoire", locale, searchParams });
}

export default async function Accessoires({ params, searchParams }: PageProps<"/[locale]/accessoires">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageCatalogue famille="accessoire" locale={locale} searchParams={searchParams} />;
}
