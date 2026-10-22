import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BoutonWhatsApp } from "@/components/vitrine/BoutonWhatsApp";
import { FormulaireContact } from "@/components/vitrine/FormulaireContact";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { routing } from "@/i18n/routing";
import { lireNomSite, lireNumeroWhatsappOuNull } from "@/lib/reglages";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { pageContactJsonLd } from "@/lib/seo/jsonld";
import { construireMetadata } from "@/lib/seo/metadata";
import { urlLocalisee } from "@/lib/seo/url";

const CHEMIN = "/contact";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.contact" });
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite() });
}

export default async function Contact({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Contact");
  const tm = await getTranslations("Metadata.contact");
  const numero = await lireNumeroWhatsappOuNull();

  return (
    <section className="flex flex-col items-start gap-6">
      <JsonLd donnees={pageContactJsonLd({ nom: tm("titre"), description: tm("description"), url: urlLocalisee(locale, CHEMIN), langue: locale })} />
      <TitreVitrine niveau={1}>{t("titre")}</TitreVitrine>
      <p className="t-body max-w-prose text-text-secondary">{t("intro")}</p>
      <div className="w-full max-w-xl">
        <FormulaireContact />
      </div>
      {numero ? (
        <div className="flex flex-col items-start gap-3">
          <p className="t-body text-text-secondary">{t("whatsapp")}</p>
          <BoutonWhatsApp numero={numero} />
        </div>
      ) : null}
    </section>
  );
}
