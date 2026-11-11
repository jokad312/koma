import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ResultatDesinscription } from "@/components/preferences/ResultatDesinscription";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

// Désinscription par le lien d'un Email commercial (story 9.4, FR-45), sans connexion : page de confirmation, puis POST signé du bouton
// (décision de Jonathan du 2026-11-10). Ouvrir le lien ne change rien. Le message de succès est le résultat réel de l'écriture en base
// (règle 13). Page jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/desinscription">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.desinscription" });
  return construireMetadata({ locale, chemin: "/desinscription", titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function Contenu({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[locale]/desinscription">["searchParams"] }) {
  await connection();
  const { c, a, s } = await searchParams;
  return <ResultatDesinscription locale={locale} c={c} a={a} s={s} />;
}

export default async function PageDesinscription({ params, searchParams }: PageProps<"/[locale]/desinscription">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Desinscription");
  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="t-h1">{t("titre")}</h1>
      <Suspense fallback={<Squelette />}>
        <Contenu locale={locale} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
