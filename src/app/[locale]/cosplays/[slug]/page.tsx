import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { metadataFiche, PageFiche } from "@/components/fiche/PageFiche";
import { routing } from "@/i18n/routing";

// Adresse dynamique (le produit est lu à chaque requête : prix et disponibilité, AD-17) : la route est rendue à la demande, ce qui permet une vraie 404.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/cosplays/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return metadataFiche({ famille: "cosplay", locale, slug });
}

export default async function FicheCosplay({ params }: PageProps<"/[locale]/cosplays/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageFiche famille="cosplay" locale={locale} slug={slug} />;
}
