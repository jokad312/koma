import { getTranslations } from "next-intl/server";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cheminPublic } from "@/i18n/adresses";
import { formaterUsd } from "@/lib/argent";
import { JsonLd } from "@/lib/seo/balise-jsonld";
import { filArianeJsonLd, produitJsonLd } from "@/lib/seo/jsonld";
import { urlLocalisee } from "@/lib/seo/url";
import { contientMarqueur } from "@/lib/vitrine/marqueur";
import { disponibiliteSchema, tronquerDescription } from "@/modules/catalogue/fiche";
import type { FicheProduit as Donnees } from "@/modules/catalogue/types";
import { BandeauZone } from "./BandeauZone";
import { BoutonPartager } from "./BoutonPartager";
import { GaleriePhotos } from "./GaleriePhotos";
import { ZoneAchat } from "./ZoneAchat";

// Dossier interne de chaque famille (l'adresse de chaque langue vient de src/i18n/adresses.ts).
export const DOSSIERS_FICHE: Record<Donnees["famille"], string> = { cosplay: "/cosplays", accessoire: "/accessoires" };

const SEPARATEUR_FIL = "›";

type Props = {
  fiche: Donnees;
  locale: Locale;
  forfaitGoma: number | null;
  forfaitBukavu: number | null;
  retraitGoma: string | null;
};

// Fiche d'un produit physique : galerie, titre, prix USD, description, fil d'Ariane, bandeau de zone avant la zone d'achat,
// modes de remise. Aucune valeur inventée : un forfait ou un lieu non réglé n'est pas affiché. Pas d'ajout au panier (epic 4).
export async function FicheProduit({ fiche, locale, forfaitGoma, forfaitBukavu, retraitGoma }: Props) {
  const t = await getTranslations({ locale, namespace: "Fiche.fil" });
  const tc = await getTranslations({ locale, namespace: "Catalogue" });
  const dossier = DOSSIERS_FICHE[fiche.famille];
  const urlFiche = urlLocalisee(locale, `${dossier}/${fiche.slug}`);
  const nomCatalogue = tc(`titre.${fiche.famille}`);
  const description = fiche.description && !contientMarqueur(fiche.description) ? fiche.description : null;

  return (
    <article className="flex flex-col gap-6">
      <JsonLd
        donnees={filArianeJsonLd([
          { nom: t("accueil"), url: urlLocalisee(locale) },
          { nom: nomCatalogue, url: urlLocalisee(locale, dossier) },
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
          disponibilite: disponibiliteSchema(fiche.tailles),
        })}
      />
      <nav aria-label={t("navigation")}>
        <ol className="t-small flex flex-wrap items-center gap-2 text-text-secondary">
          <li>
            <Link href="/" className="inline-flex min-h-touch items-center text-text-primary underline">
              {t("accueil")}
            </Link>
          </li>
          <li aria-hidden="true">{SEPARATEUR_FIL}</li>
          <li>
            <Link href={cheminPublic(locale, dossier)} className="inline-flex min-h-touch items-center text-text-primary underline">
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
          {description ? <p className="t-body whitespace-pre-line text-text-primary">{description}</p> : null}
          <BoutonPartager titre={fiche.titre} url={urlFiche} />
          <BandeauZone />
          <ZoneAchat locale={locale} tailles={fiche.tailles} forfaitGoma={forfaitGoma} forfaitBukavu={forfaitBukavu} retraitGoma={retraitGoma} />
        </div>
      </div>
    </article>
  );
}
