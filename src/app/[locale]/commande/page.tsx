import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageCommande } from "@/components/commande/PageCommande";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

const CHEMIN = "/commande";

export async function generateMetadata({ params }: PageProps<"/[locale]/commande">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.commande" });
  // Page privée du client : jamais indexée.
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function Contenu({ locale, searchParams }: { locale: "fr" | "en"; searchParams: PageProps<"/[locale]/commande">["searchParams"] }) {
  const { origine } = await searchParams;
  return <PageCommande locale={locale} origine={Array.isArray(origine) ? origine[0] : origine} />;
}

export default async function Commande({ params, searchParams }: PageProps<"/[locale]/commande">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Commande");
  return (
    <section className="flex flex-col items-stretch gap-6">
      <h1 className="t-h1">{t("titre")}</h1>
      {/* La session et le cookie du Panier sont des données de requête : sous Suspense, le titre reste statique. */}
      <Suspense fallback={<Squelette />}>
        <Contenu locale={locale} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
