import { getTranslations } from "next-intl/server";
import { TitreVitrine } from "@/components/ui/TitreVitrine";
import { lireHeros } from "@/components/accueil/HerosAccueil";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import type { VedetteHeros } from "@/modules/accueil/heros-queries";

// Bloc 1 « Porte-le ou fabrique-le » (FR-2) : le Cosplay vedette porté (prix, délai) et le Kit lié fabriqué (prix).
// Seul si le Cosplay vedette a un Kit lié publié ; un bloc sans contenu reste masqué (aucun titre, aucun texte, aucun espace).
export async function BlocPorteOuFabrique({ locale }: { locale: Locale }) {
  const heros = await lireHeros(locale);
  const vedette: VedetteHeros | null = heros?.vedette ?? null;
  const aKit = Boolean(vedette && vedette.hrefKit && vedette.titreKit && vedette.prixCentsKit !== null);
  if (!vedette || !aKit) return null;
  const t = await getTranslations({ locale, namespace: "Accueil" });
  return (
    <section aria-labelledby="accueil-porte-ou-fabrique" className="flex flex-col gap-4">
      <div id="accueil-porte-ou-fabrique">
        <TitreVitrine niveau={2}>{t("porteOuFabrique.titre")}</TitreVitrine>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="verre-fort relative overflow-hidden rounded-xl border border-border bg-surface p-5">
          <p className="t-label text-text-primary">{t("heros.pretAPorter")}</p>
          <p className="t-h3">
            <Link href={cheminPublic(locale, vedette.href)} className="text-text-primary no-underline after:absolute after:inset-0 focus-visible:outline-none">
              {vedette.titre}
            </Link>
          </p>
          <p className="t-price-card text-text-primary">{formaterUsd(vedette.prixCents, locale)}</p>
          {vedette.delaiJours !== null ? <p className="t-small text-text-primary">{t("heros.delai", { n: vedette.delaiJours })}</p> : null}
        </article>
        <article className="verre-fort relative overflow-hidden rounded-xl border border-border bg-surface p-5">
          <p className="t-label text-text-primary">{t("heros.fabriquer")}</p>
          <p className="t-h3">
            <Link href={cheminPublic(locale, vedette.hrefKit ?? "")} className="text-text-primary no-underline after:absolute after:inset-0 focus-visible:outline-none">
              {vedette.titreKit}
            </Link>
          </p>
          <p className="t-price-card text-text-primary">{formaterUsd(vedette.prixCentsKit ?? 0, locale)}</p>
          <p className="t-small text-text-primary">{t("heros.acces")}</p>
        </article>
      </div>
    </section>
  );
}
