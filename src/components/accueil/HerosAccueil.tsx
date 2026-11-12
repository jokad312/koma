import Image from "next/image";
import { cache, Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { CLASSES_PRINCIPAL } from "@/components/ui/classes";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import { lireCartesHeros } from "@/modules/accueil/heros-cartes";
import type { CartesHeros } from "@/modules/accueil/heros-cartes-choix";
import { lireHerosPublic, type HerosPublic } from "@/modules/accueil/heros-queries";
import type { CarteProduit } from "@/modules/catalogue/types";
import { MediaHeros } from "./MediaHeros";

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
const FOCUS = "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary";

// Photo détourée du Cosplay vedette (photo de repli réglée dans l'admin), halo derrière. Sans photo de repli : première photo de la
// vedette ; sans rien : pas de média ni de halo vide. La vidéo, si elle existe, vient au même emplacement.
function MediaVue({ videoUrl, repli }: { videoUrl: string | null; repli: { url: string; alt: string; detoure: boolean } | null }) {
  if (!repli && !videoUrl) return null;
  return (
    <div className="relative min-h-[26rem] xl:col-start-3 xl:row-span-4 xl:row-start-1 xl:min-h-0">
      <div aria-hidden="true" className="halo-heros absolute inset-0" />
      <MediaHeros videoUrl={videoUrl} repli={repli} />
    </div>
  );
}

async function Media({ locale }: { locale: Locale }) {
  const heros = await lireHeros(locale);
  if (!heros) return null;
  const repli = heros.repli ? { ...heros.repli, detoure: true } : heros.vedette ? { url: heros.vedette.photoUrl, alt: heros.vedette.photoAlt, detoure: false } : null;
  return <MediaVue videoUrl={heros.videoUrl} repli={repli} />;
}

function CarteProduitHeros({ produit, etiquette, locale }: { produit: CarteProduit; etiquette: string; locale: Locale }) {
  return (
    // La légende n'est pas positionnée (photo à z-index négatif dans une pile isolée) : le lien du nom, étendu par pseudo-élément, couvre toute la carte.
    <li className={`relative isolate flex min-h-[15.5rem] w-[12.5rem] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-glass bg-surface shadow-lg ${FOCUS}`}>
      <Image src={produit.photoUrl} alt={produit.photoAlt} fill sizes="200px" className="-z-10 object-cover" />
      <div className="m-2 mt-24 flex flex-col gap-0.5 rounded-md border border-glass-border bg-glass-strong p-3">
        <p className="t-label text-text-primary">{etiquette}</p>
        <p className="t-h3 line-clamp-2">
          <Link href={cheminPublic(locale, `${DOSSIER[produit.famille]}/${produit.slug}`)} data-mesure="clic_heros" className="text-text-primary no-underline after:absolute after:inset-0 focus-visible:outline-none">
            {produit.titre}
          </Link>
        </p>
        <p className="t-price-card text-text-primary">{formaterUsd(produit.prixCents, locale)}</p>
      </div>
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
    <div className="flex min-w-0 items-end gap-4 xl:col-span-2 xl:col-start-1 xl:row-start-3">
      <ul role="list" aria-label={t("cartes")} className="-mx-1 flex min-w-0 flex-1 snap-x gap-3.5 overflow-x-auto px-1 pb-3 pt-1 xl:flex-none xl:overflow-visible">
        {cosplay ? <CarteProduitHeros produit={cosplay} etiquette={t("carteCosplay")} locale={locale} /> : null}
        {accessoire ? <CarteProduitHeros produit={accessoire} etiquette={t("carteAccessoire")} locale={locale} /> : null}
        {kit ? (
          <li className={`relative flex min-h-[15.5rem] w-[15.5rem] shrink-0 snap-start flex-col gap-2 rounded-glass border border-border bg-surface p-4 shadow-lg ${FOCUS}`}>
            <p className="t-label flex items-center gap-2 text-text-primary">
              <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full bg-primary" />
              {t("kitDuMois")}
            </p>
            <p className="t-h2 line-clamp-3 text-text-primary">{kit.titre}</p>
            <p className="t-small text-text-secondary">{t("kitPhrase")}</p>
            <Link
              href={cheminPublic(locale, `${DOSSIER.kit}/${kit.slug}`)}
              data-mesure="clic_heros"
              aria-label={t("voirKitNomme", { titre: kit.titre })}
              className={`${CLASSES_PRINCIPAL} mt-auto self-start`}
            >
              {t("voirKit")}
            </Link>
          </li>
        ) : null}
      </ul>
      <Link
        href={cheminPublic(locale, cosplay ? DOSSIER.cosplay : accessoire ? DOSSIER.accessoire : DOSSIER.kit)}
        data-mesure="clic_heros"
        aria-label={t("versCatalogue")}
        className="mb-3 inline-flex size-[3.25rem] shrink-0 items-center justify-center rounded-full bg-primary text-on-primary no-underline"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}

// Le H1 est dans la coque statique, une seule fois (jamais en double, même sans JavaScript) ; le média et la rangée de cartes arrivent de la
// lecture de la requête, chacun dans sa propre limite d'attente, sans repli visible (jamais de squelette sur le héros).
// Ordre du DOM = ordre de lecture (texte, colonnes, photo, cartes, signature) ; sur ordinateur, la grille place la photo à droite.
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
    <section aria-label={t("region")} className="relative isolate overflow-hidden rounded-xl bg-background xl:min-h-[44rem]">
      {/* Mot géant décoratif : texte généré par CSS (attr), donc ni lu, ni sélectionnable, ni candidat au LCP (il retarderait la mesure sans rien montrer d'utile). */}
      <p aria-hidden="true" data-mot={t("motGeant")} className="mot-geant pointer-events-none absolute -right-4 top-6 -z-10 select-none whitespace-nowrap xl:top-8" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-6 px-4 py-6 xl:grid-cols-[minmax(0,28rem)_minmax(0,15rem)_minmax(0,1fr)] xl:grid-rows-[auto_1fr_auto_auto] xl:px-10 xl:pb-8 xl:pt-8">
        <div className="flex flex-col gap-4 xl:col-start-1 xl:row-start-1">
          <p className="t-label text-text-secondary">{t("surtitre")}</p>
          <span aria-hidden="true" className="flex gap-24 xl:gap-32">
            <span className="size-2.5 rounded-full bg-text-primary" />
            <span className="size-2.5 rounded-full bg-text-primary" />
          </span>
          <TitreVitrine niveau={1}>{t("accroche")}</TitreVitrine>
          <div className="flex flex-wrap gap-3">
            <Link href={cheminPublic(locale, "/cosplays")} data-mesure="clic_heros" className="t-button inline-flex min-h-touch items-center justify-center rounded-full bg-text-primary px-5 py-3 text-center text-background no-underline">
              {t("voirCosplays")}
            </Link>
            <Link href={cheminPublic(locale, "/kits")} data-mesure="clic_heros" className={CLASSES_PRINCIPAL}>
              {t("decouvrirKits")}
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-5 xl:col-start-2 xl:row-start-1">
          <p className="t-small text-text-primary">
            <span className="t-label mb-1.5 flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-0.5 w-4 shrink-0 bg-primary" />
              {t("faitMainTitre")}
            </span>
            {t("faitMainTexte")}
          </p>
          <p className="t-small text-text-primary">
            <span className="t-label mb-1.5 flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-0.5 w-4 shrink-0 bg-primary" />
              {t("kitsTitre")}
            </span>
            {t("kitsTexte")}
          </p>
        </div>
        {media}
        {cartes}
        <p className="t-label text-text-secondary xl:col-span-2 xl:col-start-1 xl:row-start-4">{t("signature")}</p>
      </div>
    </section>
  );
}
