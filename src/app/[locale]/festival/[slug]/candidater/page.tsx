import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageCandidature } from "@/components/festival/PageCandidature";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

type Props = PageProps<"/[locale]/festival/[slug]/candidater">;

// Page privée de l'exposant (session, état de la vente) : rendue à la demande, jamais préparée à l'avance.
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.festivalCandidature" });
  // Candidature : jamais indexée.
  return construireMetadata({ locale, chemin: `/festival/${encodeURIComponent(slug)}/candidater`, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function Contenu({ locale, params }: { locale: "fr" | "en"; params: Props["params"] }) {
  const { slug } = await params;
  return <PageCandidature locale={locale} slug={slug} />;
}

export default async function Candidater({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Festival.candidature");
  return (
    <section className="mx-auto flex w-full max-w-[720px] flex-col items-stretch gap-6">
      <h1 className="t-h1">{t("titre")}</h1>
      <Suspense fallback={<Squelette />}>
        <Contenu locale={locale} params={params} />
      </Suspense>
    </section>
  );
}
