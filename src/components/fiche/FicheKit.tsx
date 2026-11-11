import { getTranslations } from "next-intl/server";
import { decouperParagraphes } from "@/lib/vitrine/pages-legales";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { filArianeJsonLd, produitJsonLd, videoJsonLd } from "@/lib/seo/jsonld";
import { urlLocalisee } from "@/lib/seo/url";
import { contientMarqueur } from "@/lib/vitrine/marqueur";
import { adressesExtrait } from "@/modules/catalogue/extrait";
import { tronquerDescription } from "@/modules/catalogue/fiche";
import { tailleLisible } from "@/modules/catalogue/fichiers-kit";
import { formaterInstant } from "@/modules/catalogue/sous-titres";
import type { FicheKit as Donnees } from "@/modules/catalogue/types";
import { BoutonPartager } from "./BoutonPartager";
import { GaleriePhotos } from "./GaleriePhotos";
import { LecteurExtrait } from "./LecteurExtrait";
import { ObtentionKit } from "./ObtentionKit";

export const DOSSIER_KITS = "/kits";
const SEPARATEUR_FIL = "›";

type Props = { fiche: Donnees; locale: Locale; hoteCdn: string | null };

const texteReel = (t: string | null) => (t && !contientMarqueur(t) ? t : null);

// Fiche d'un Kit : galerie, titre, prix USD, niveau, description, matériel, fichiers (format, taille), plan des chapitres, résumé de la
// Licence de kit, extrait public lisible au clavier et sous-titré. Pas d'achat (epic 4) ; le Kit gratuit s'obtient par ObtentionKit (story 3.5). Le HTML ne contient
// jamais de chemin kits-private ni d'identifiant de la bibliothèque Bunny privée : seules les données publiables sont lues.
export async function FicheKit({ fiche, locale, hoteCdn }: Props) {
  const tf = await getTranslations({ locale, namespace: "Fiche.fil" });
  const tc = await getTranslations({ locale, namespace: "Catalogue" });
  const t = await getTranslations({ locale, namespace: "Kit" });
  const urlFiche = urlLocalisee(locale, `${DOSSIER_KITS}/${fiche.slug}`);
  const nomCatalogue = tc("titre.kit");
  const description = texteReel(fiche.description);
  const materiel = texteReel(fiche.materiel);
  const extrait = fiche.extrait ? adressesExtrait(hoteCdn, fiche.extrait.id) : null;
  const taille = (octets: number) => {
    const { valeur, unite } = tailleLisible(octets, locale);
    return t(`fichiers.taille.${unite}`, { valeur });
  };
  // Sous /en, la vidéo complète sans sous-titres anglais est signalée (FR-29).
  const sansAnglais = locale === "en" && !fiche.sousTitres.includes("en");
  // Sous /en, un extrait parlé sans sous-titres anglais est signalé.
  const extraitSansAnglais = locale === "en" && fiche.extrait !== null && !fiche.extrait.sansParole && !fiche.extrait.sousTitres.includes("en");

  return (
    <article className="flex flex-col gap-6">
      <JsonLd
        donnees={filArianeJsonLd([
          { nom: tf("accueil"), url: urlLocalisee(locale) },
          { nom: nomCatalogue, url: urlLocalisee(locale, DOSSIER_KITS) },
          { nom: fiche.titre, url: urlFiche },
        ])}
      />
      <JsonLd
        donnees={produitJsonLd({
          nom: fiche.titre,
          description: tronquerDescription(description, 500) ?? fiche.titre,
          images: fiche.photos.map((p) => p.url),
          url: urlFiche,
          langue: locale,
          prixCents: fiche.prixCents,
          disponibilite: "https://schema.org/InStock",
        })}
      />
      {extrait && fiche.extrait?.enregistreLe ? (
        <JsonLd
          donnees={videoJsonLd({
            nom: t("extrait.nomVideo", { titre: fiche.titre }),
            description: tronquerDescription(description, 500) ?? fiche.titre,
            vignette: extrait.vignette,
            dateEnvoi: new Date(fiche.extrait.enregistreLe).toISOString(),
            contenu: extrait.playlist,
            langue: locale,
          })}
        />
      ) : null}
      <nav aria-label={tf("navigation")}>
        <ol className="t-small flex flex-wrap items-center gap-2 text-text-secondary">
          <li>
            <Link href="/" className="inline-flex min-h-touch items-center text-text-primary underline">
              {tf("accueil")}
            </Link>
          </li>
          <li aria-hidden="true">{SEPARATEUR_FIL}</li>
          <li>
            <Link href={cheminPublic(locale, DOSSIER_KITS)} className="inline-flex min-h-touch items-center text-text-primary underline">
              {nomCatalogue}
            </Link>
          </li>
          <li aria-hidden="true">{SEPARATEUR_FIL}</li>
          <li aria-current="page">{fiche.titre}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <GaleriePhotos photos={fiche.photos} />
        <div className="flex min-w-0 flex-col gap-6">
          <TitreVitrine niveau={1}>{fiche.titre}</TitreVitrine>
          <p className="t-price-card text-text-primary">{formaterUsd(fiche.prixCents, locale)}</p>
          {fiche.niveau ? <p className="t-body text-text-primary">{t("niveauLibelle", { niveau: t(`niveau.${fiche.niveau}`) })}</p> : null}
          {description ? <p className="t-body whitespace-pre-line text-text-primary">{description}</p> : null}
          <ObtentionKit produitId={fiche.id} prixCents={fiche.prixCents} />
          <BoutonPartager titre={fiche.titre} url={urlFiche} />
        </div>
      </div>

      {extrait && fiche.extrait ? (
        <section aria-labelledby="kit-extrait" className="flex flex-col gap-3">
          <h2 id="kit-extrait" className="t-h2">
            {t("extrait.titre")}
          </h2>
          <p className="t-small text-text-secondary">{t("extrait.aide")}</p>
          {extraitSansAnglais ? <p className="t-small text-text-primary">{t("extrait.sansAnglais")}</p> : null}
          <LecteurExtrait
            playlist={extrait.playlist}
            vignette={extrait.vignette}
            titre={t("extrait.nomVideo", { titre: fiche.titre })}
            pistes={fiche.extrait.sousTitres.map((langue) => ({
              langue,
              src: extrait.sousTitres(langue),
              libelle: t(`sousTitres.langues.${langue}`),
              parDefaut: langue === locale,
            }))}
          />
        </section>
      ) : null}

      {materiel ? (
        <section aria-labelledby="kit-materiel" className="flex flex-col gap-3">
          <h2 id="kit-materiel" className="t-h2">
            {t("materiel.titre")}
          </h2>
          <p className="t-body whitespace-pre-line text-text-primary">{materiel}</p>
        </section>
      ) : null}

      <section aria-labelledby="kit-fichiers" className="flex flex-col gap-3">
        <h2 id="kit-fichiers" className="t-h2">
          {t("fichiers.titre")}
        </h2>
        {fiche.fichiers.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {fiche.fichiers.map((f, i) => (
              <li key={`${f.format}-${i}`} className="t-body text-text-primary">
                {t("fichiers.ligne", { nom: f.nom, format: t(`fichiers.formats.${f.format}`), taille: taille(f.tailleOctets) })}
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-body text-text-secondary">{t("fichiers.vide")}</p>
        )}
      </section>

      <section aria-labelledby="kit-chapitres" className="flex flex-col gap-3">
        <h2 id="kit-chapitres" className="t-h2">
          {t("chapitres.titre")}
        </h2>
        {fiche.dureeSecondes ? <p className="t-small text-text-secondary">{t("chapitres.duree", { duree: formaterInstant(fiche.dureeSecondes) })}</p> : null}
        {sansAnglais ? <p className="t-small text-text-primary">{t("sousTitres.sansAnglais")}</p> : null}
        {fiche.chapitres.length > 0 ? (
          <ol className="flex list-decimal flex-col gap-2 ps-6">
            {fiche.chapitres.map((c) => (
              <li key={c.ordre} className="t-body text-text-primary">
                <span>{c.titre}</span> <span className="t-small text-text-secondary">{t("chapitres.debut", { instant: formaterInstant(c.debutSecondes) })}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="t-body text-text-secondary">{t("chapitres.vide")}</p>
        )}
      </section>

      <section aria-labelledby="kit-licence" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="kit-licence" className="t-h2">
          {t("licence.titre")}
        </h2>
        {decouperParagraphes(t("licence.texte")).map((paragraphe, i) => (
          <p key={i} className="t-body whitespace-pre-line text-text-primary">
            {paragraphe}
          </p>
        ))}
      </section>
    </article>
  );
}
