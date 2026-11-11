import { getTranslations } from "next-intl/server";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { pageWebJsonLd } from "@/lib/seo/jsonld";
import { lireNomSite } from "@/lib/reglages";
import { urlLocalisee } from "@/lib/seo/url";
import { decouperParagraphes, formaterVersion, PAGES_LEGALES, PAGES_SANS_VERSION, type ClePageLegale } from "@/lib/vitrine/pages-legales";

// Page légale : H1, date de version, paragraphes. Le contenu vient de messages/*.json (Legal.<cle>), jamais du code.
export async function PageLegale({ locale, cle }: { locale: "fr" | "en"; cle: ClePageLegale }) {
  const t = await getTranslations({ locale, namespace: "Legal" });
  const tm = await getTranslations({ locale, namespace: "Metadata.legal" });
  // Le nom du site vient des réglages (le texte écrit « {nomSite} »), jamais du code.
  const nomSite = await lireNomSite();
  const chemin = PAGES_LEGALES.find((p) => p.cle === cle)!.chemin;
  const version = PAGES_SANS_VERSION.includes(cle) ? null : formaterVersion(t(`${cle}.version`), locale);
  return (
    <article className="flex flex-col items-start gap-6">
      <JsonLd donnees={pageWebJsonLd({ nom: tm(`${cle}.titre`), description: tm(`${cle}.description`), url: urlLocalisee(locale, chemin), langue: locale })} />
      <TitreVitrine niveau={1}>{t(`${cle}.titre`)}</TitreVitrine>
      {version ? (
        <p className="t-small text-text-secondary">
          {t("versionDu")} {version.iso ? <time dateTime={version.iso}>{version.texte}</time> : version.texte}
        </p>
      ) : null}
      <div className="flex w-full flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        {decouperParagraphes(t(`${cle}.texte`, { nomSite })).map((paragraphe, i) => (
          <p key={i} className="t-body whitespace-pre-line text-text-secondary">
            {paragraphe}
          </p>
        ))}
      </div>
    </article>
  );
}
