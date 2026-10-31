import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { metadataFicheKit, PageFicheKit } from "@/components/fiche/PageFicheKit";
import { routing } from "@/i18n/routing";

// Adresse dynamique (le Kit est lu à chaque requête : prix, AD-17) : la route est rendue à la demande, ce qui permet une vraie 404.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/kits/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return metadataFicheKit({ locale, slug });
}

export default async function FicheKit({ params }: PageProps<"/[locale]/kits/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageFicheKit locale={locale} slug={slug} />;
}
