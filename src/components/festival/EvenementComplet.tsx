import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BoutonPartager } from "@/components/fiche/BoutonPartager";
import { AchatEvenement } from "./AchatEvenement";
import { BlocPrevenir } from "./BlocPrevenir";
import { ContenuArticle } from "@/components/blog/ContenuArticle";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import { formaterDateHeureBoutique, versIsoBoutique } from "@/lib/dates";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { evenementJsonLd, filArianeJsonLd } from "@/lib/seo/jsonld";
import { urlLocalisee } from "@/lib/seo/url";
import { extraireTexte } from "@/modules/blog/texte";
import type { EvenementPublic } from "@/modules/evenements/types";

const SEPARATEUR_FIL = "›";

type Props = { evenement: EvenementPublic; locale: Locale };

// Une page Événement : fil d'Ariane et JSON-LD, titre en H1, date et lieu, programme (même rendu Markdown nettoyé que le blog),
// photos avec le texte alternatif de la langue, cartes des Types de pass en lecture seule (nom, prix USD, avantages) et « Partager ».
// « Me prévenir » (story 7.3) tant que la vente n'est pas ouverte. Aucun compteur de places. Le bouton « Acheter des pass » (ou « Complet », « Vente fermée »)
// est un composant à part, lu à chaque requête sous Suspense : le reste de la page reste en cache (story 7.4). Un Événement passé est marqué comme tel.
export async function EvenementComplet({ evenement, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "Festival" });
  const tn = await getTranslations({ locale, namespace: "Navigation" });
  const url = urlLocalisee(locale, `/festival/${evenement.slug}`);
  const nomRubrique = tn("rubriques.festival");
  const debut = formaterDateHeureBoutique(evenement.debutLe, locale);
  const fin = evenement.finLe ? formaterDateHeureBoutique(evenement.finLe, locale) : null;

  return (
    <article className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
      <JsonLd
        donnees={filArianeJsonLd([
          { nom: t("fil.accueil"), url: urlLocalisee(locale) },
          { nom: nomRubrique, url: urlLocalisee(locale, "/festival") },
          { nom: evenement.titre, url },
        ])}
      />
      <JsonLd
        donnees={evenementJsonLd({
          nom: evenement.titre,
          description: evenement.programme ? extraireTexte(evenement.programme) : null,
          lieu: evenement.lieu,
          debut: versIsoBoutique(evenement.debutLe) ?? evenement.debutLe,
          fin: versIsoBoutique(evenement.finLe),
          images: evenement.images.map((image) => image.url),
          url,
          langue: locale,
          offres: evenement.types.map((type) => ({ nom: type.nom, prixCents: type.prixCents })),
        })}
      />
      <nav aria-label={t("fil.navigation")}>
        <ol className="t-small flex flex-wrap items-center gap-2 text-text-secondary">
          <li>
            <Link href="/" className="inline-flex min-h-touch items-center text-text-primary underline">
              {t("fil.accueil")}
            </Link>
          </li>
          <li aria-hidden="true">{SEPARATEUR_FIL}</li>
          <li>
            <Link href="/festival" className="inline-flex min-h-touch items-center text-text-primary underline">
              {nomRubrique}
            </Link>
          </li>
          <li aria-hidden="true">{SEPARATEUR_FIL}</li>
          <li aria-current="page">{evenement.titre}</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-2">
        <TitreVitrine niveau={1}>{evenement.titre}</TitreVitrine>
        {evenement.passe ? <p className="t-label text-text-secondary">{t("passe")}</p> : null}
        {debut ? (
          <p className="t-body text-text-primary">
            <time dateTime={evenement.debutLe}>{debut}</time>
            {fin ? (
              <>
                {" – "}
                <time dateTime={evenement.finLe ?? undefined}>{fin}</time>
              </>
            ) : null}
          </p>
        ) : null}
        {evenement.lieu ? <p className="t-body text-text-secondary">{evenement.lieu}</p> : null}
      </header>

      {evenement.images.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {evenement.images.map((image, i) => (
            <li key={image.url} className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface">
              <Image src={image.url} alt={image.alt} fill sizes="(min-width: 1024px) 480px, 100vw" priority={i === 0} className="object-cover" />
            </li>
          ))}
        </ul>
      ) : null}

      {evenement.programme ? (
        <section aria-labelledby="festival-programme" className="flex max-w-[720px] flex-col gap-3">
          <h2 id="festival-programme" className="t-h2">
            {t("programme")}
          </h2>
          <ContenuArticle texte={evenement.programme} />
        </section>
      ) : null}

      {evenement.galerieUrl ? (
        <section aria-labelledby="festival-galerie" className="flex max-w-[720px] flex-col gap-3">
          <h2 id="festival-galerie" className="t-h2">
            {t("galerie.titre")}
          </h2>
          <p className="t-body text-text-primary">{t("galerie.texte")}</p>
          <a href={evenement.galerieUrl} target="_blank" rel="noopener noreferrer" className="t-body inline-flex min-h-touch items-center text-text-primary underline">
            {t("galerie.lien")}
          </a>
          <p className="t-small text-text-secondary">{t("galerie.retrait")}</p>
        </section>
      ) : null}

      {evenement.types.length > 0 ? (
        <section aria-labelledby="festival-pass" className="flex flex-col gap-4">
          <h2 id="festival-pass" className="t-h2">
            {t("pass")}
          </h2>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {evenement.types.map((type) => (
              <li key={type.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <h3 className="t-h3">{type.nom}</h3>
                <p className="t-price-card">{formaterUsd(type.prixCents, locale)}</p>
                {type.inclus ? (
                  <ul className="t-small flex list-disc flex-col gap-1 pl-5 text-text-secondary">
                    {type.inclus
                      .split("\n")
                      .map((ligne) => ligne.trim())
                      .filter((ligne) => ligne !== "")
                      .map((ligne, i) => (
                        <li key={`${i}-${ligne}`}>{ligne}</li>
                      ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Suspense fallback={null}>
        <AchatEvenement evenement={evenement} locale={locale} />
      </Suspense>

      {evenement.venteAVenir ? <BlocPrevenir evenementId={evenement.id} venteOuvreLe={evenement.venteOuvreLe} locale={locale} /> : null}

      <BoutonPartager titre={evenement.titre} url={url} />
    </article>
  );
}
