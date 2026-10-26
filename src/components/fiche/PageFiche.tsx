import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import type { Locale } from "@/i18n/routing";
import { lireForfaitLivraison, lireNomSite, lireRetraitGoma } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { tronquerDescription } from "@/modules/catalogue/fiche";
import { lireFicheProduit } from "@/modules/catalogue/queries";
import type { FamillePhysique } from "@/modules/catalogue/types";
import { DOSSIERS_FICHE, FicheProduit } from "./FicheProduit";

type Props = { famille: FamillePhysique; locale: Locale; slug: string };

// Une seule lecture par requête, partagée par les métadonnées et la page.
const lireFiche = cache(lireFicheProduit);

// Réglage de remise facultatif : une lecture impossible n'affiche rien (jamais une valeur de repli), la cause est journalisée.
async function lireOuNull<T>(lecture: () => Promise<T | null>): Promise<T | null> {
  try {
    return await lecture();
  } catch {
    console.error("[fiche] lecture d'un réglage de remise impossible : valeur non affichée");
    return null;
  }
}

// Titre et description uniques, Open Graph avec la première photo, twitter:card, canonique et hreflang à l'adresse propre de chaque langue.
// Produit introuvable (brouillon, dépublié, autre famille) : 404. Lecture impossible : page non indexée.
export async function metadataFiche({ famille, locale, slug }: Props): Promise<Metadata> {
  let fiche;
  try {
    fiche = await lireFiche(famille, slug, locale);
  } catch {
    console.error("[fiche] lecture impossible");
    return { robots: { index: false, follow: false } };
  }
  if (!fiche) notFound();
  const t = await getTranslations({ locale, namespace: "Fiche.meta" });
  const nomSite = await lireNomSite();
  return construireMetadata({
    locale,
    chemin: `${DOSSIERS_FICHE[famille]}/${slug}`,
    titre: fiche.titre,
    description: tronquerDescription(fiche.description) ?? t("descriptionRepli", { titre: fiche.titre, nomSite }),
    nomSite,
    image: { url: fiche.photos[0].url, alt: fiche.photos[0].alt },
  });
}

export async function PageFiche({ famille, locale, slug }: Props) {
  let fiche;
  try {
    fiche = await lireFiche(famille, slug, locale);
  } catch {
    // Jamais une fiche inventée : message sobre, rien d'autre sur la page.
    console.error("[fiche] lecture impossible");
    const t = await getTranslations({ locale, namespace: "Fiche" });
    return <MessageEtat type="erreur">{t("erreur")}</MessageEtat>;
  }
  if (!fiche) notFound();

  const [forfaitGoma, forfaitBukavu, retraitGoma] = await Promise.all([
    lireOuNull(() => lireForfaitLivraison("goma")),
    lireOuNull(() => lireForfaitLivraison("bukavu")),
    lireOuNull(() => lireRetraitGoma(locale)),
  ]);
  return <FicheProduit fiche={fiche} locale={locale} forfaitGoma={forfaitGoma} forfaitBukavu={forfaitBukavu} retraitGoma={retraitGoma} />;
}
