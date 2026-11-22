"use client";

import { LibelleVariante } from "@/components/commande/LibelleVariante";
import { useTranslations } from "next-intl";
import { MessageEtat } from "@/components/ui/MessageEtat";
import type { Locale } from "@/i18n/routing";
import { formaterUsd } from "@/lib/argent";
import type { ModeRemise, ZoneRemise } from "@/modules/commande/schemas";
import type { Recapitulatif } from "@/modules/commande/types";
import { Nombre, nb } from "@/components/ui/Nombre";

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
            {l.famille !== "kit" ? <p className="t-small text-text-secondary"><LibelleVariante espace="Commande.recap" taille={l.taille} couleur={l.couleur} /></p> : null}
            {l.etat === "epuise" ? (
              <>
                <p className="t-small text-text-primary">{t("plusDisponible")}</p>
                <MessageEtat type="attention">{t("plusDisponibleAide")}</MessageEtat>
              </>
            ) : (
              <>
                <p className="t-body text-text-primary">
                  {t.rich("quantitePrix", { nombre: l.nombre, prix: formaterUsd(l.prixCents, locale), nb })}
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
          <dd className="t-body text-text-primary"><Nombre>{formaterUsd(recap.sousTotalCents, locale)}</Nombre></dd>
        </div>
        {recap.code?.valide && recap.reductionCents > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="t-body text-text-primary">{t.rich("reduction", { code: recap.code.code, nb })}</dt>
            <dd className="t-body text-text-primary">{t.rich("reductionMontant", { montant: formaterUsd(recap.reductionCents, locale), nb })}</dd>
          </div>
        ) : null}
        {recap.physique ? (
          <div className="flex justify-between gap-4">
            <dt className="t-body text-text-primary">{t("forfait")}</dt>
            <dd className="t-body text-text-primary">
              {recap.remiseManquante ? t("forfaitAChoisir") : recap.forfaitCents === 0 ? t("forfaitGratuit") : <Nombre>{formaterUsd(recap.forfaitCents, locale)}</Nombre>}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="t-h3 text-text-primary">{t("total")}</dt>
          <dd className="t-price-card text-text-primary"><Nombre>{formaterUsd(recap.totalCents, locale)}</Nombre></dd>
        </div>
      </dl>
    </section>
  );
}
