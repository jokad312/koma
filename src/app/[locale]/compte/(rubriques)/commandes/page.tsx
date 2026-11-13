import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ListeCommandes } from "@/components/commande/ListeCommandes";
import { Squelette } from "@/components/ui/Squelette";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";

// Page privée du client, rendue à la demande : jamais indexée.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/compte/commandes">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.compteCommandes" });
  return construireMetadata({ locale, chemin: "/compte/commandes", titre: t("titre"), description: t("description"), nomSite: await lireNomSite(), indexable: false });
}

async function Contenu({ locale, searchParams }: { locale: "fr" | "en"; searchParams: PageProps<"/[locale]/compte/commandes">["searchParams"] }) {
  const { n } = await searchParams;
  const brut = Number(Array.isArray(n) ? n[0] : n);
  // Nombre affiché : multiple de 12, entre 12 et 240.
  const nombre = Number.isInteger(brut) && brut >= 12 && brut <= 240 && brut % 12 === 0 ? brut : 12;
  return <ListeCommandes locale={locale} nombre={nombre} />;
}

export default async function MesCommandes({ params, searchParams }: PageProps<"/[locale]/compte/commandes">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Commande");
  return (
    <section className="flex flex-col gap-4">
      <h2 className="t-h2">{t("liste.titre")}</h2>
      <Suspense fallback={<Squelette />}>
        <Contenu locale={locale} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
