import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageDetailCommande } from "@/components/commande/PageDetailCommande";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

// Adresse dynamique propre à chaque client (numéro de commande, session) : rendue à la demande, jamais préparée à l'avance.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/commande/[numero]">): Promise<Metadata> {
  const { locale, numero } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.commandeDetail" });
  // Page privée du client : jamais indexée, et le numéro n'est pas dans le titre.
  return construireMetadata({
    locale,
    chemin: `/commande/${encodeURIComponent(numero)}`,
    titre: t("titre"),
    description: t("description"),
    nomSite: await lireNomSite(),
    indexable: false,
  });
}

async function Contenu({ locale, params }: { locale: "fr" | "en"; params: PageProps<"/[locale]/commande/[numero]">["params"] }) {
  const { numero } = await params;
  return <PageDetailCommande locale={locale} numero={numero} />;
}

export default async function DetailCommande({ params }: PageProps<"/[locale]/commande/[numero]">) {
  const { locale, numero } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Commande");
  return (
    <section className="flex flex-col items-stretch gap-6">
      <h1 className="t-h1">{t("detail.titre", { numero })}</h1>
      <Suspense fallback={<Squelette />}>
        <Contenu locale={locale} params={params} />
      </Suspense>
    </section>
  );
}
