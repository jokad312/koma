import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBibliotheque } from "@/components/bibliotheque/PageBibliotheque";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/compte/bibliotheque">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.bibliotheque" });
  // Page privée du client : jamais indexée.
  return construireMetadata({ locale, chemin: "/compte/bibliotheque", titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

export default async function Bibliotheque({ params }: PageProps<"/[locale]/compte/bibliotheque">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Bibliotheque" });
  return (
    <>
      <h2 className="t-h2">{t("titre")}</h2>
      {/* La session est une donnée de requête : sous Suspense, le titre reste statique. */}
      <Suspense fallback={<Squelette />}>
        <PageBibliotheque locale={locale} />
      </Suspense>
    </>
  );
}
