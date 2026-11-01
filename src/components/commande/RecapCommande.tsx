"use client";

import { useTranslations } from "next-intl";
import { MessageEtat } from "@/components/ui/MessageEtat";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import type { ModeRemise, ZoneRemise } from "@/modules/commande/schemas";
import type { Recapitulatif } from "@/modules/commande/types";

type Props = { recap: Recapitulatif; zone: ZoneRemise | null; mode: ModeRemise | null; locale: Locale };

function cleRemise(zone: ZoneRemise | null, mode: ModeRemise | null): "inconnue" | "retrait" | "gomaLivraison" | "bukavu" {
  if (!zone || !mode) return "inconnue";
  if (zone === "bukavu") return "bukavu";
  return mode === "retrait" ? "retrait" : "gomaLivraison";
}

// Récapitulatif (FR-14, UX-DR32) : tous les montants et les délais viennent du serveur, relus à chaque changement de Zone ou de Mode.
export function RecapCommande({ recap, zone, mode, locale }: Props) {
  const t = useTranslations("Commande.recap");
  const remise = t(`remise.${cleRemise(zone, mode)}`);

  return (
    <section aria-labelledby="commande-recap" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <h2 id="commande-recap" className="t-h2">
        {t("titre")}
      </h2>
      <ul aria-label={t("liste")} className="flex flex-col gap-3">
        {recap.lignes.map((l) => (
          <li key={l.ligneId} className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
            <p className="t-label text-text-primary">{l.titre}</p>
            {l.famille !== "kit" ? <p className="t-small text-text-secondary">{l.taille === "sur_mesure" ? t("tailleSurMesure") : t("taille", { taille: l.taille ?? "" })}</p> : null}
            {l.etat === "epuise" ? (
              <>
                <p className="t-small text-text-primary">{t("plusDisponible")}</p>
                <MessageEtat type="attention">{t("plusDisponibleAide")}</MessageEtat>
              </>
            ) : (
              <>
                <p className="t-body text-text-primary">
                  {t("quantitePrix", { nombre: l.nombre, prix: formaterUsd(l.prixCents, locale) })}
                </p>
                {l.famille === "kit" ? (
                  <p className="t-small text-text-secondary">{t("accesImmediat")}</p>
                ) : l.origine === "fabrication" && l.delaiFabricationJours !== null ? (
                  <p className="t-small text-text-secondary">
                    {t(l.taille === "sur_mesure" ? "delaiFabricationSurMesure" : "delaiFabrication", { n: l.delaiFabricationJours, remise })}
                  </p>
                ) : (
                  <p className="t-small text-text-secondary">{t("delaiStock", { remise })}</p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-2">
        <div className="flex justify-between gap-4">
          <dt className="t-body text-text-primary">{t("sousTotal")}</dt>
          <dd className="t-body text-text-primary">{formaterUsd(recap.sousTotalCents, locale)}</dd>
        </div>
        {recap.physique ? (
          <div className="flex justify-between gap-4">
            <dt className="t-body text-text-primary">{t("forfait")}</dt>
            <dd className="t-body text-text-primary">
              {recap.remiseManquante ? t("forfaitAChoisir") : recap.forfaitCents === 0 ? t("forfaitGratuit") : formaterUsd(recap.forfaitCents, locale)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="t-h3 text-text-primary">{t("total")}</dt>
          <dd className="t-price-card text-text-primary">{formaterUsd(recap.totalCents, locale)}</dd>
        </div>
      </dl>
    </section>
  );
}
