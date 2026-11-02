import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageKitBibliotheque } from "@/components/bibliotheque/PageKitBibliotheque";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

// Adresse dynamique (le slug du Kit est lu à la requête, avec la session) : rendue à la demande, comme la fiche d'un Kit.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/compte/bibliotheque/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.bibliotheque" });
  return construireMetadata({ locale, chemin: `/compte/bibliotheque/${slug}`, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

export default async function KitBibliotheque({ params }: PageProps<"/[locale]/compte/bibliotheque/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Squelette />}>
      <PageKitBibliotheque locale={locale} slug={slug} />
    </Suspense>
  );
}
