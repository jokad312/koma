import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { QuestionsFaq, type ElementFaq } from "@/components/vitrine/QuestionsFaq";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { routing } from "@/i18n/routing";
import { lireNomSite } from "@/lib/reglages";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { faqJsonLd, pageWebJsonLd } from "@/lib/seo/jsonld";
import { construireMetadata } from "@/lib/seo/metadata";
import { urlLocalisee } from "@/lib/seo/url";

const CHEMIN = "/faq";
// Questions de la FAQ, dans l'ordre d'affichage. Chaque question et chaque réponse viennent de Jonathan (marqueur tant qu'elles manquent).
const QUESTIONS = ["paiement", "livraison", "delais"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/faq">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata.faq" });
  return construireMetadata({ locale, chemin: CHEMIN, titre: t("titre"), description: t("description"), nomSite: await lireNomSite() });
}

export default async function Faq({ params }: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Faq");
  const tm = await getTranslations("Metadata.faq");
  const elements: ElementFaq[] = QUESTIONS.map((cle) => ({ cle, question: t(`questions.${cle}.question`), reponse: t(`questions.${cle}.reponse`) }));
  const url = urlLocalisee(locale, CHEMIN);
  // FAQPage des seules vraies paires ; aucune paire réelle : WebPage.
  const donnees =
    faqJsonLd(elements, { url, langue: locale }) ?? pageWebJsonLd({ nom: tm("titre"), description: tm("description"), url, langue: locale });

  return (
    <section className="flex flex-col items-start gap-6">
      <JsonLd donnees={donnees} />
      <TitreVitrine niveau={1}>{t("titre")}</TitreVitrine>
      <div className="w-full">
        <QuestionsFaq elements={elements} />
      </div>
    </section>
  );
}
