import { getTranslations } from "next-intl/server";
import { QuestionsFaq, type ElementFaq } from "@/components/vitrine/QuestionsFaq";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { faqJsonLd } from "@/lib/seo/jsonld";
import { urlLocalisee } from "@/lib/seo/url";
import { QUESTIONS_FAQ_COURTE } from "@/modules/accueil/blocs";

// Bloc 8 : FAQ courte, construite à partir des entrées de l'espace `Faq` (mêmes textes, pas de copie).
// JSON-LD FAQPage des seules paires réelles (sans marqueur) ; aucune paire réelle : aucun JSON-LD.
export async function BlocFaqCourte({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Accueil.faqCourte" });
  const tf = await getTranslations({ locale, namespace: "Faq" });
  const elements: ElementFaq[] = QUESTIONS_FAQ_COURTE.map((cle) => ({
    cle,
    question: tf(`questions.${cle}.question`),
    reponse: tf(`questions.${cle}.reponse`),
  }));
  const donnees = faqJsonLd(elements, { url: urlLocalisee(locale), langue: locale });
  return (
    <section aria-labelledby="accueil-faq" className="flex flex-col gap-4">
      {donnees ? <JsonLd donnees={donnees} /> : null}
      <div id="accueil-faq">
        <TitreVitrine niveau={2}>{t("titre")}</TitreVitrine>
      </div>
      <QuestionsFaq elements={elements} />
      <Link href="/faq" className="t-label inline-flex min-h-touch items-center self-start text-text-primary underline">
        {t("toutes")}
      </Link>
    </section>
  );
}
