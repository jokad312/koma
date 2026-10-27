import Image from "next/image";
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

// Héros lu à chaque requête (prix et disponibilité de la vedette : règle 3). Lecture en erreur : le héros reste en texte (accroche seule),
// jamais un média ni un produit inventé.
async function lireHeros(locale: Locale): Promise<HerosPublic | null> {
  // Attend la vraie requête : pendant le prérendu de la coque, Next.js annule les lectures non mises en cache.
  await connection();
  try {
    return await lireHerosPublic(locale);
  } catch (e) {
    unstable_rethrow(e);
    console.error("[accueil] lecture du héros impossible :", e instanceof Error ? e.name : "erreur inconnue");
    return null;
  }
}

async function Panneau({ locale, vedette }: { locale: Locale; vedette: VedetteHeros | null }) {
  const t = await getTranslations({ locale, namespace: "Accueil.heros" });
  return (
    <div className="verre-fort relative z-10 m-3 flex max-w-xl flex-col gap-3 p-5">
      <p className="t-label text-text-primary">{t("surtitre")}</p>
      <TitreVitrine niveau={1}>{t("accroche")}</TitreVitrine>
      {vedette ? (
        // Sur ordinateur, l'accès à la fiche est la tuile de droite.
        <Link href={cheminPublic(locale, vedette.href)} className={`${CLASSES_PRINCIPAL} self-start lg:hidden`}>
          {t("pretAPorter")}
        </Link>
      ) : null}
    </div>
  );
}

async function TuileVedette({ locale, vedette }: { locale: Locale; vedette: VedetteHeros }) {
  const t = await getTranslations({ locale, namespace: "Accueil.heros" });
  return (
    <article className="verre-fort relative hidden overflow-hidden lg:flex lg:flex-col focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
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

// Coque statique et repli de chargement : l'accroche (H1, texte réel) est là dès le premier octet ; jamais de squelette sur le héros.
export async function HerosCoque({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Accueil.heros" });
  return (
    <section aria-label={t("region")} className="relative flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-xl" style={FOND}>
      <Panneau locale={locale} vedette={null} />
    </section>
  );
}

export async function HerosAccueil({ locale }: { locale: Locale }) {
  const heros = await lireHeros(locale);
  const t = await getTranslations({ locale, namespace: "Accueil.heros" });
  const vedette = heros?.vedette ?? null;
  const aMedia = Boolean(heros && (heros.repli || heros.videoUrl));
  return (
    <section aria-label={t("region")} className={vedette ? "grid gap-4 lg:grid-cols-3" : "grid gap-4"}>
      <div
        className={`relative flex flex-col justify-end overflow-hidden rounded-xl ${vedette ? "lg:col-span-2" : ""} ${aMedia ? "min-h-[28rem] lg:min-h-[32rem]" : "min-h-[22rem]"}`}
        style={FOND}
      >
        {heros && aMedia ? <MediaHeros videoUrl={heros.videoUrl} repli={heros.repli} /> : null}
        <Panneau locale={locale} vedette={vedette} />
      </div>
      {vedette ? <TuileVedette locale={locale} vedette={vedette} /> : null}
    </section>
  );
}
