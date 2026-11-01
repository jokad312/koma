import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PagePanier } from "@/components/panier/PagePanier";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

const CHEMIN = "/panier";

export async function generateMetadata({ params }: PageProps<"/[locale]/panier">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.panier" });
  // Page privée du visiteur : jamais indexée.
  return construireMetadata({
    locale,
    chemin: CHEMIN,
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

export default async function Panier({ params }: PageProps<"/[locale]/panier">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Panier");
  return (
    <section className="flex flex-col items-stretch gap-6">
      <h1 className="t-h1">{t("titre")}</h1>
      {/* Le cookie du Panier est une donnée de requête : sous Suspense, le titre reste statique. */}
      <Suspense fallback={<Squelette />}>
        <PagePanier locale={locale} />
      </Suspense>
    </section>
  );
}
