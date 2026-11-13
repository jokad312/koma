import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ListeMesPass } from "@/components/compte/ListeMesPass";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

// « Mon compte › Mes Pass » (story 7.5) : page privée, rendue à la demande, jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/compte/pass">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.comptePass" });
  return construireMetadata({ locale, chemin: "/compte/pass", titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

export default async function MesPass({ params }: PageProps<"/[locale]/compte/pass">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Pass");
  return (
    <section className="flex flex-col gap-4">
      <h2 className="t-h2">{t("titre")}</h2>
      <Suspense fallback={<Squelette />}>
        <ListeMesPass locale={locale} />
      </Suspense>
    </section>
  );
}
