import Image from "next/image";
import { cache, Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lireCartesHeros } from "@/modules/accueil/heros-cartes";
import type { CartesHeros } from "@/modules/accueil/heros-cartes-choix";
import { lireHerosPublic, type HerosPublic } from "@/modules/accueil/heros-queries";
import type { CarteProduit } from "@/modules/catalogue/types";
import { formaterUsd } from "@/lib/argent";
import { MediaHeros } from "./MediaHeros";
import "./hero-visiteur.css";

// Héros lu à chaque requête (une seule lecture par requête, partagée par le média, les cartes et le bloc « Porte-le ou fabrique-le »)
// (prix et disponibilité de la vedette : règle 3). Lecture en erreur : le héros reste en texte, jamais un média ni un produit inventé.
export const lireHeros = cache(async (locale: Locale): Promise<HerosPublic | null> => {
  // Attend la vraie requête : pendant le prérendu de la coque, Next.js annule les lectures non mises en cache.
  await connection();
  try {
    return await lireHerosPublic(locale);
  } catch (e) {
    unstable_rethrow(e);
    console.error("[accueil] lecture du héros impossible :", e instanceof Error ? e.name : "erreur inconnue");
    return null;
  }
});

const DOSSIER: Record<CarteProduit["famille"], string> = { cosplay: "/cosplays", accessoire: "/accessoires", kit: "/kits" };

// Haut de l'accueil du visiteur : reproduction de la maquette docs/design/maquette-accueil/fusion.html (1440 px : positions, tailles et
// couleurs de la maquette, voir hero-visiteur.css ; en dessous de 1280 px, une seule colonne). Les images et les cartes viennent des vraies données.

// Photo détourée du Cosplay vedette (photo de repli réglée dans l'admin), halo derrière. Sans photo de repli : première photo de la
// vedette ; sans rien : pas de média ni de halo vide (le héros se recentre, voir .hv:has(.sans-media)). La vidéo, si elle existe, vient au même emplacement.
export function MediaVue({ videoUrl, repli }: { videoUrl: string | null; repli: { url: string; alt: string; detoure: boolean } | null }) {
  if (!repli && !videoUrl) return <span hidden className="sans-media" />;
  return (
    <div className="hv-media">
      <div aria-hidden="true" className="hv-halo" />
      <div className="hv-photo">
        <MediaHeros videoUrl={videoUrl} repli={repli} />
      </div>
    </div>
  );
}

async function Media({ locale }: { locale: Locale }) {
  const heros = await lireHeros(locale);
  if (!heros) return <MediaVue videoUrl={null} repli={null} />;
  const repli = heros.repli ? { ...heros.repli, detoure: true } : heros.vedette ? { url: heros.vedette.photoUrl, alt: heros.vedette.photoAlt, detoure: false } : null;
  return <MediaVue videoUrl={heros.videoUrl} repli={repli} />;
}

function CarteProduitHeros({ produit, etiquette, nom, locale }: { produit: CarteProduit; etiquette: string; nom: string; locale: Locale }) {
  return (
    // Seule l'étiquette de la maquette est visible ; le nom accessible la reprend en tête (WCAG 2.5.3), suivie du nom et du prix. Le lien couvre toute la carte.
    <li className="hv-carte">
      <Image src={produit.photoUrl} alt={produit.photoAlt} fill sizes="200px" className="hv-carte-photo" />
      <Link href={cheminPublic(locale, `${DOSSIER[produit.famille]}/${produit.slug}`)} data-mesure="clic_heros" className="hv-carte-lien">
        <span className="sr-only">
          {nom}
        </span>
      </Link>
      <span aria-hidden="true" className="hv-carte-etiquette">
        {etiquette}
      </span>
    </li>
  );
}

async function RangeeCartes({ locale }: { locale: Locale }) {
  const heros = await lireHeros(locale);
  const slugVedette = heros?.vedette?.slug ?? null;
  return <RangeeVue locale={locale} cartes={await lireCartesHeros(locale, slugVedette)} />;
}

export async function RangeeVue({ locale, cartes }: { locale: Locale; cartes: CartesHeros }) {
  const { cosplay, accessoire, kit } = cartes;
  // Aucun produit publié dans les trois familles : la rangée n'existe pas (ni cartes, ni bouton).
  if (!cosplay && !accessoire && !kit) return null;
  const t = await getTranslations({ locale, namespace: "Accueil.heros" });
  return (
    <>
      <ul role="list" aria-label={t("cartes")} className="hv-rangee">
        {cosplay ? (
          <CarteProduitHeros
            produit={cosplay}
            etiquette={t("carteCosplay")}
            nom={t("carteNom", { etiquette: t("carteCosplay"), titre: cosplay.titre, prix: formaterUsd(cosplay.prixCents, locale) })}
            locale={locale}
          />
        ) : null}
        {accessoire ? (
          <CarteProduitHeros
            produit={accessoire}
            etiquette={t("carteAccessoire")}
            nom={t("carteNom", { etiquette: t("carteAccessoire"), titre: accessoire.titre, prix: formaterUsd(accessoire.prixCents, locale) })}
            locale={locale}
          />
        ) : null}
        {kit ? (
          <li className="hv-kit">
            <p className="hv-kit-etiquette">{t("kitDuMois")}</p>
            <p className="hv-kit-titre">{kit.titre}</p>
            <p className="hv-kit-phrase">{t("kitPhrase")}</p>
            <Link href={cheminPublic(locale, `${DOSSIER.kit}/${kit.slug}`)} data-mesure="clic_heros" aria-label={t("voirKitNomme", { titre: kit.titre })} className="hv-bouton hv-bouton-rouge hv-kit-bouton">
              {t("voirKit")}
            </Link>
          </li>
        ) : null}
      </ul>
      <Link href={cheminPublic(locale, cosplay ? DOSSIER.cosplay : accessoire ? DOSSIER.accessoire : DOSSIER.kit)} data-mesure="clic_heros" aria-label={t("versCatalogue")} className="hv-rond">
        <svg aria-hidden="true" viewBox="0 0 17 14" width="17" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 7h15M10 1l6 6-6 6" />
        </svg>
      </Link>
    </>
  );
}

// Le H1 est dans la coque statique, une seule fois (jamais en double, même sans JavaScript) ; le média et la rangée de cartes arrivent de la
// lecture de la requête, chacun dans sa propre limite d'attente, sans repli visible (jamais de squelette sur le héros).
// Ordre du DOM = ordre de lecture (texte, colonnes, boutons, photo, cartes, signature) ; sur ordinateur, le CSS place chaque élément comme la maquette.
export async function HerosAccueil({ locale }: { locale: Locale }) {
  return (
    <HerosVue
      locale={locale}
      media={
        <Suspense fallback={null}>
          <Media locale={locale} />
        </Suspense>
      }
      cartes={
        <Suspense fallback={null}>
          <RangeeCartes locale={locale} />
        </Suspense>
      }
    />
  );
}

// Mise en page seule : les deux emplacements (photo, cartes) reçoivent leur contenu de l'appelant.
async function HerosVue({ locale, media, cartes }: { locale: Locale; media: ReactNode; cartes: ReactNode }) {
  const t = await getTranslations({ locale, namespace: "Accueil.heros" });
  return (
    <section aria-label={t("region")} className="hv">
      <div className="hv-cadre">
        {/* Mot géant décoratif : texte généré par CSS (attr), donc ni lu, ni sélectionnable, ni candidat au LCP. */}
        <p aria-hidden="true" data-mot={t("motGeant")} className="hv-geant" />
        <p className="hv-surtitre">{t("surtitre")}</p>
        <span aria-hidden="true" className="hv-points">
          <span />
          <span />
          <span />
        </span>
        <div className="hv-titre">
          <TitreVitrine niveau={1}>{t("accroche")}</TitreVitrine>
        </div>
        <div className="hv-colonnes">
          <p>
            <b>{t("faitMainTitre")}</b>
            {t("faitMainTexte")}
          </p>
          <p>
            <b>{t("kitsTitre")}</b>
            {t("kitsTexte")}
          </p>
        </div>
        <div className="hv-boutons">
          <Link href={cheminPublic(locale, "/cosplays")} data-mesure="clic_heros" className="hv-bouton hv-bouton-encre">
            {t("voirCosplays")}
          </Link>
          <Link href={cheminPublic(locale, "/kits")} data-mesure="clic_heros" className="hv-bouton hv-bouton-rouge">
            {t("decouvrirKits")}
          </Link>
        </div>
        {media}
        {cartes}
        <p className="hv-signature">{t("signature")}</p>
      </div>
    </section>
  );
}
