import Image from "next/image";
import { cache, Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { BadgeDisponibilite } from "@/components/catalogue/BadgeDisponibilite";
import { CLASSES_PRINCIPAL } from "@/components/ui/classes";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import { lireHerosPublic, type HerosPublic, type VedetteHeros } from "@/modules/accueil/heros-queries";
import { MediaHeros } from "./MediaHeros";

const FOND = { backgroundImage: "linear-gradient(135deg, var(--ks-hero-wash-start), var(--ks-hero-wash-end))" } as const;

// Héros lu à chaque requête (une seule lecture par requête, partagée par le média, le bouton et la tuile) (prix et disponibilité de la vedette : règle 3). Lecture en erreur : le héros reste en texte (accroche seule),
// jamais un média ni un produit inventé.
const lireHeros = cache(async (locale: Locale): Promise<HerosPublic | null> => {
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

// Le H1 est dans la coque statique, une seule fois (jamais en double, même sans JavaScript) ; le média, le bouton « Prêt à porter » et la tuile
// arrivent de la lecture de la requête, chacun dans sa propre limite d'attente, sans repli visible (jamais de squelette sur le héros).
async function Media({ locale }: { locale: Locale }) {
  const heros = await lireHeros(locale);
  if (!heros || !(heros.repli || heros.videoUrl)) return null;
  return <MediaHeros videoUrl={heros.videoUrl} repli={heros.repli} />;
}

async function BoutonVedette({ locale }: { locale: Locale }) {
  const heros = await lireHeros(locale);
  if (!heros?.vedette) return null;
  const t = await getTranslations({ locale, namespace: "Accueil.heros" });
  // Sur ordinateur, l'accès à la fiche est la tuile de droite.
  return (
    <Link href={cheminPublic(locale, heros.vedette.href)} className={`${CLASSES_PRINCIPAL} self-start lg:hidden`}>
      {t("pretAPorter")}
    </Link>
  );
}

async function TuileVedette({ locale }: { locale: Locale }) {
  const heros = await lireHeros(locale);
  const vedette: VedetteHeros | null = heros?.vedette ?? null;
  if (!vedette) return null;
  const t = await getTranslations({ locale, namespace: "Accueil.heros" });
  return (
    <article className="verre-fort relative hidden overflow-hidden focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary lg:flex lg:w-1/3 lg:shrink-0 lg:flex-col">
      <div className="relative aspect-[4/5] w-full bg-background">
        <Image src={vedette.photoUrl} alt={vedette.photoAlt} fill sizes="33vw" className="object-cover" />
      </div>
      <div className="flex flex-col gap-1 p-4">
        <p className="t-label text-text-primary">{t("pretAPorter")}</p>
        <p className="t-h3">
          <Link href={cheminPublic(locale, vedette.href)} className="text-text-primary no-underline after:absolute after:inset-0 focus-visible:outline-none">
            {vedette.titre}
          </Link>
        </p>
        <p className="t-price-card text-text-primary">{formaterUsd(vedette.prixCents, locale)}</p>
        <BadgeDisponibilite etat={vedette.disponibilite} />
        {vedette.delaiJours !== null ? <p className="t-small text-text-primary">{t("delai", { n: vedette.delaiJours })}</p> : null}
      </div>
    </article>
  );
}

export async function HerosAccueil({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Accueil.heros" });
  return (
    <section aria-label={t("region")} className="flex flex-col gap-4 lg:flex-row">
      <div className="relative flex min-h-[26rem] flex-1 flex-col justify-end overflow-hidden rounded-xl lg:min-h-[32rem]" style={FOND}>
        <Suspense fallback={null}>
          <Media locale={locale} />
        </Suspense>
        <div className="verre-fort relative z-10 m-3 flex max-w-xl flex-col gap-3 p-5">
          <p className="t-label text-text-primary">{t("surtitre")}</p>
          <TitreVitrine niveau={1}>{t("accroche")}</TitreVitrine>
          <Suspense fallback={null}>
            <BoutonVedette locale={locale} />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={null}>
        <TuileVedette locale={locale} />
      </Suspense>
    </section>
  );
}
