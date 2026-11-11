import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageAchatPass } from "@/components/festival/PageAchatPass";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

type Props = PageProps<"/[locale]/festival/[slug]/acheter">;

// Page privée du client (session, état de la vente) : rendue à la demande, jamais préparée à l'avance.
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.festivalAchat" });
  // Page d'achat : jamais indexée.
  return construireMetadata({ locale, chemin: `/festival/${encodeURIComponent(slug)}/acheter`, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function Contenu({ locale, params }: { locale: "fr" | "en"; params: Props["params"] }) {
  const { slug } = await params;
  return <PageAchatPass locale={locale} slug={slug} />;
}

export default async function AcheterDesPass({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Festival.achat");
  return (
    <section className="mx-auto flex w-full max-w-[960px] flex-col items-stretch gap-6">
      <h1 className="t-h1">{t("titre")}</h1>
      {/* La session et l'état de la vente sont des données de requête : sous Suspense, le titre reste statique. */}
      <Suspense fallback={<Squelette />}>
        <Contenu locale={locale} params={params} />
      </Suspense>
    </section>
  );
}
