import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { metadataFiche, PageFiche } from "@/components/fiche/PageFiche";
import { routing } from "@/i18n/routing";

// Adresse dynamique (le produit est lu à chaque requête : prix et disponibilité, AD-17) : la route est rendue à la demande, ce qui permet une vraie 404.
export const instant = false;

// Adresse publique : /fr/vetements/<slug> et /en/clothing/<slug> (src/i18n/adresses.ts) ; ce dossier sert les deux langues.
export async function generateMetadata({ params }: PageProps<"/[locale]/vetements/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return metadataFiche({ famille: "vetement", locale, slug });
}

export default async function FicheVetement({ params }: PageProps<"/[locale]/vetements/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageFiche famille="vetement" locale={locale} slug={slug} />;
}
