import Image from "next/image";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import { lireCartesHeros } from "@/modules/accueil/heros-cartes";
import type { CartesHeros } from "@/modules/accueil/heros-cartes-choix";
import type { CarteProduit } from "@/modules/catalogue/types";
import { lireHeros } from "./HerosAccueil";
import { MediaHeros } from "./MediaHeros";
import { PleineLargeur } from "./PleineLargeur";
import "./heros-visiteur.css";

// Haut de l'accueil du visiteur non connecté : maquette docs/design/maquette-accueil/fusion.html (variantes claire et sombre), à 1440 px :
// titre à gauche, deux blocs « Fait main à Goma » / « Kits à fabriquer » à droite, mot géant en fond qui déborde à gauche, photo détourée du
// Cosplay vedette avec sa lueur, trois cartes et le bouton rond, signature en bas à gauche. Polices du site (Barlow, Barlow Condensed).
// Tout le style est dans heros-visiteur.css (classes « hv- » propres à ce composant) : rien dans le CSS commun ni dans l'en-tête.
// Sans produit publié : la disposition reste la même, seules la photo et les cartes (avec le bouton rond) disparaissent.

const DOSSIER: Record<CarteProduit["famille"], string> = { cosplay: "/cosplays", accessoire: "/accessoires", kit: "/kits" };

async function Media({ locale }: { locale: Locale }) {
  const heros = await lireHeros(locale);
  if (!heros) return null;
  const repli = heros.repli ? { ...heros.repli, detoure: true } : heros.vedette ? { url: heros.vedette.photoUrl, alt: heros.vedette.photoAlt, detoure: false } : null;
  if (!repli && !heros.videoUrl) return null;
  return (
    <div className="hv-media">
      <div aria-hidden="true" className="hv-lueur" />
      <div className="hv-photo">
        <MediaHeros videoUrl={heros.videoUrl} repli={repli} />
      </div>
    </div>
  );
}

function CarteProduitHeros({ produit, etiquette, nom, locale }: { produit: CarteProduit; etiquette: string; nom: string; locale: Locale }) {
  return (
    // L'étiquette visible ouvre le nom accessible (WCAG 2.5.3), suivie du nom et du prix. Le lien couvre toute la carte.
    <li className="hv-carte">
      <Image src={produit.photoUrl} alt={produit.photoAlt} fill sizes="200px" className="hv-carte-photo" />
      <Link href={cheminPublic(locale, `${DOSSIER[produit.famille]}/${produit.slug}`)} data-mesure="clic_heros" className="hv-carte-lien">
        <span className="sr-only">{nom}</span>
      </Link>
      <span aria-hidden="true" className="hv-carte-etiquette">
        {etiquette}
      </span>
    </li>
  );
}

async function Cartes({ locale }: { locale: Locale }) {
  const heros = await lireHeros(locale);
  return <CartesVue locale={locale} cartes={await lireCartesHeros(locale, heros?.vedette?.slug ?? null)} />;
}

export async function CartesVue({ locale, cartes }: { locale: Locale; cartes: CartesHeros }) {
  const { cosplay, accessoire, kit } = cartes;
  if (!cosplay && !accessoire && !kit) return null;
  const t = await getTranslations({ locale, namespace: "Accueil.herosVisiteur" });
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

// Ordre du DOM = ordre de lecture (surtitre, titre, blocs, boutons, photo, cartes, signature) ; à 1280 px et plus, le CSS place chaque élément
// comme la maquette ; en dessous, une seule colonne.
export async function HerosVisiteur({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Accueil.herosVisiteur" });
  const lignes = t("accroche").split("\n");
  return (
    <PleineLargeur className="hv-pleine">
      <section aria-label={t("region")} className="hv-heros">
        <div className="hv-cadre">
          {/* Mot géant décoratif : texte généré par CSS (attr), ni lu, ni sélectionnable. */}
          <p aria-hidden="true" data-mot={t("motGeant")} className="hv-geant" />
          <p className="hv-surtitre">{t("surtitre")}</p>
          {/* Deux points sur trois places, comme la maquette (le troisième emplacement reste vide). */}
          <span aria-hidden="true" className="hv-points">
            <span />
            <span />
            <span />
          </span>
          <h1 className="hv-titre">
            {lignes.map((ligne, i) => (
              <span key={i} className="hv-ligne-titre">
                {ligne}
              </span>
            ))}
          </h1>
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
          <Suspense fallback={null}>
            <Media locale={locale} />
          </Suspense>
          <Suspense fallback={null}>
            <Cartes locale={locale} />
          </Suspense>
          <p className="hv-signature">{t("signature")}</p>
        </div>
      </section>
    </PleineLargeur>
  );
}
