import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { MesureVueFiche } from "@/components/mesure/MesureVueFiche";
import type { Locale } from "@/i18n/routing";
import { lireHoteCdnPublic } from "@/lib/bunny/config";
import { lireNomSite } from "@/lib/reglages";
import { construireMetadata } from "@/lib/seo/metadata";
import { tronquerDescription } from "@/modules/catalogue/fiche";
import { lireFicheKit } from "@/modules/catalogue/queries";
import { DOSSIER_KITS, FicheKit } from "./FicheKit";

type Props = { locale: Locale; slug: string };

// Une seule lecture par requête, partagée par les métadonnées et la page.
const lireFiche = cache(lireFicheKit);

// Titre et description uniques, Open Graph avec la première photo, canonique et hreflang. Kit introuvable : 404 ; lecture impossible : noindex.
export async function metadataFicheKit({ locale, slug }: Props): Promise<Metadata> {
  let fiche;
  try {
    fiche = await lireFiche(slug, locale);
  } catch {
    console.error("[fiche kit] lecture impossible");
    return { robots: { index: false, follow: false } };
  }
  if (!fiche) notFound();
  const t = await getTranslations({ locale, namespace: "Kit.meta" });
  const nomSite = await lireNomSite();
  return construireMetadata({
    locale,
    chemin: `${DOSSIER_KITS}/${slug}`,
    titre: fiche.titre,
    description: tronquerDescription(fiche.description) ?? t("descriptionRepli", { titre: fiche.titre, nomSite }),
    nomSite,
    image: { url: fiche.photos[0].url, alt: fiche.photos[0].alt },
  });
}

export async function PageFicheKit({ locale, slug }: Props) {
  let fiche;
  try {
    fiche = await lireFiche(slug, locale);
  } catch {
    // Jamais une fiche inventée : message sobre, rien d'autre sur la page.
    console.error("[fiche kit] lecture impossible");
    const t = await getTranslations({ locale, namespace: "Fiche" });
    return <MessageEtat type="erreur">{t("erreur")}</MessageEtat>;
  }
  if (!fiche) notFound();
  return (
    <>
      <MesureVueFiche />
      <FicheKit fiche={fiche} locale={locale} hoteCdn={lireHoteCdnPublic()} />
    </>
  );
}
