import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BoutonWhatsApp } from "@/components/vitrine/BoutonWhatsApp";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { routing } from "@/i18n/routing";
import { lireNomSite, lireNumeroWhatsappOuNull } from "@/lib/reglages";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { pageWebJsonLd } from "@/lib/seo/jsonld";
import { construireMetadata } from "@/lib/seo/metadata";
import { urlLocalisee } from "@/lib/seo/url";

const CHEMIN = "/a-propos";
// Sections dont le texte est fourni par Jonathan (marqueur « [Texte à fournir] » tant qu'il manque).
const SECTIONS = ["portrait", "histoire", "atelier"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/a-propos">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.aPropos" });
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite() });
}

export default async function APropos({ params }: PageProps<"/[locale]/a-propos">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("APropos");
  const tm = await getTranslations("Metadata.aPropos");
  const numero = await lireNumeroWhatsappOuNull();

  return (
    <section className="flex flex-col items-start gap-6">
      <JsonLd donnees={pageWebJsonLd({ nom: tm("titre"), description: tm("description"), url: urlLocalisee(locale, CHEMIN), langue: locale })} />
      <TitreVitrine niveau={1}>{t("titre")}</TitreVitrine>
      {SECTIONS.map((cle) => (
        <section key={cle} aria-labelledby={`a-propos-${cle}`} className="flex w-full flex-col gap-2 rounded-lg border border-border bg-surface p-5">
          <h2 id={`a-propos-${cle}`} className="t-h3">
            {t(`${cle}.titre`)}
          </h2>
          <p className="t-body text-text-secondary">{t(`${cle}.texte`)}</p>
        </section>
      ))}
      <BoutonWhatsApp numero={numero} />
    </section>
  );
}
