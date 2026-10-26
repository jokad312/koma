import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { metadataCatalogue, PageCatalogue } from "@/components/catalogue/PageCatalogue";
import { routing } from "@/i18n/routing";

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/cosplays">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return metadataCatalogue({ famille: "cosplay", locale, searchParams });
}

export default async function Cosplays({ params, searchParams }: PageProps<"/[locale]/cosplays">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageCatalogue famille="cosplay" locale={locale} searchParams={searchParams} />;
}
