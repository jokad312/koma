import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { metadataCatalogue, PageCatalogue } from "@/components/catalogue/PageCatalogue";
import { routing } from "@/i18n/routing";

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/kits">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return metadataCatalogue({ famille: "kit", locale, searchParams });
}

export default async function Kits({ params, searchParams }: PageProps<"/[locale]/kits">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageCatalogue famille="kit" locale={locale} searchParams={searchParams} />;
}
