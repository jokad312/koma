import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { decouperParagraphes } from "@/lib/vitrine/pages-legales";

// Charte de la galerie « Ils le portent », affichée au-dessus des formulaires d'envoi de photo et de Réalisation (et en page à part : /charte-galerie).
// Le texte vient de messages/*.json (Legal.charte), jamais du code.
export async function CharteGalerie({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Legal.charte" });
  const tp = await getTranslations({ locale, namespace: "Pied.legal" });
  return (
    <section aria-labelledby="charte-galerie" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <h3 id="charte-galerie" className="t-h3">
        {t("titre")}
      </h3>
      {decouperParagraphes(t("texte")).map((paragraphe, i) => (
        <p key={i} className="t-body whitespace-pre-line text-text-secondary">
          {paragraphe}
        </p>
      ))}
      <Link href="/charte-galerie" className="t-small inline-flex min-h-touch items-center self-start text-text-primary underline">
        {tp("charte")}
      </Link>
    </section>
  );
}
