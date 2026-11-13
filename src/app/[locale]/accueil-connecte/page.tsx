import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BlocsAccueil } from "@/components/accueil/BlocsAccueil";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

// Accueil d'une personne connectée (option A, décision de Jonathan du 2026-11-13) : l'ancien accueil, avec son héros de la version stable du
// 2026-11-11. Le proxy sert cette page à l'adresse /[locale] quand une session est ouverte (réécriture, l'adresse affichée reste /fr ou /en) ;
// la page /[locale] reste ainsi l'accueil du visiteur, préparé à l'avance, sans lecture de session. Jamais indexée ; canonique : /[locale].
export async function generateMetadata({ params }: PageProps<"/[locale]/accueil-connecte">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.accueil" });
  return construireMetadata({ locale, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

export default async function AccueilConnecte({ params, searchParams }: PageProps<"/[locale]/accueil-connecte">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <BlocsAccueil locale={locale} searchParams={searchParams} variante="connecte" />;
}
