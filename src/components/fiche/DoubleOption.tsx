"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";
import { BandeauZone } from "./BandeauZone";
import { OPTION } from "./SelecteurTaille";
import { ZoneAchat } from "./ZoneAchat";
import type { KitLieFiche, TailleFiche } from "@/modules/catalogue/types";

type Props = {
  produitId: string;
  // Kit lié publié (double option, story 3.4) : prix et identifiant lus en base, jamais calculé côté client.
  kit: KitLieFiche;
  locale: "fr" | "en";
  tailles: readonly TailleFiche[];
  forfaitGoma: number | null;
  forfaitBukavu: number | null;
  retraitGoma: string | null;
};

// Sélecteur à deux options (UX-DR23) : « Prêt à porter » garde le parcours d'achat sur la fiche, « Le fabriquer moi-même »
// affiche sur place le panneau « Kit lié ». Radios natifs en groupe nommé : flèches, aucune sélection ne change de page ni ne
// déclenche d'action. Le panneau « Kit lié » est annoncé aux lecteurs d'écran au changement d'option ; les tailles, le délai
// et le bandeau ne sont masqués que dans l'option « fabriquer » (le panneau remplace la zone d'achat).
export function DoubleOption({
  produitId,
  kit,
  locale,
  tailles,
  forfaitGoma,
  forfaitBukavu,
  retraitGoma,
}: Props) {
  const t = useTranslations("Fiche.option");
  const [option, setOption] = useState<"porter" | "fabriquer">("porter");

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="t-small mb-2 font-semibold">{t("libelle")}</legend>
        <div className="flex flex-wrap gap-2">
          <label className={OPTION}>
            <input
              type="radio"
              name="ks-option"
              value="porter"
              checked={option === "porter"}
              onChange={() => setOption("porter")}
              className="peer sr-only"
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="hidden size-4 shrink-0 fill-none stroke-primary stroke-2 peer-checked:block"
            >
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
            <span className="t-button">{t("porter")}</span>
          </label>
          <label className={OPTION}>
            <input
              type="radio"
              name="ks-option"
              value="fabriquer"
              checked={option === "fabriquer"}
              onChange={() => setOption("fabriquer")}
              className="peer sr-only"
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="hidden size-4 shrink-0 fill-none stroke-primary stroke-2 peer-checked:block"
            >
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
            <span className="t-button">{t("fabriquer")}</span>
          </label>
        </div>
      </fieldset>
      {/* Région annoncée à chaque changement d'option : le panneau « Kit lié » ou la zone d'achat remplacée est lu par les lecteurs d'écran. */}
      <div aria-live="polite" className="flex flex-col gap-6">
        {option === "fabriquer" ? (
          <section
            aria-labelledby="double-option-kit-titre"
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <h2 id="double-option-kit-titre" className="t-h2">
              {t("kitTitre")}
            </h2>
            <p className="t-body text-text-primary">{kit.titre}</p>
            <p className="t-price-card text-text-primary">
              {formaterUsd(kit.prixCents, locale)}
            </p>
            <p className="t-small text-text-secondary">{t("acces")}</p>
            <Link
              href={cheminPublic(locale, `/kits/${kit.slug}`)}
              className="t-button text-text-primary underline"
            >
              {t("voirLeKit")}
            </Link>
          </section>
        ) : (
          <>
            <BandeauZone kit={kit} />
            <ZoneAchat
              produitId={produitId}
              locale={locale}
              tailles={tailles}
              forfaitGoma={forfaitGoma}
              forfaitBukavu={forfaitBukavu}
              retraitGoma={retraitGoma}
              kit={kit}
            />
          </>
        )}
      </div>
    </div>
  );
}
