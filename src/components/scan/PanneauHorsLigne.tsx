"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import type { useScanHorsLigne } from "./useScanHorsLigne";

type Etat = ReturnType<typeof useScanHorsLigne>;

const FUSEAU = "Africa/Lubumbashi";

// Panneau « Scan hors ligne » de l'écran de Scan (story 7.8, FR-36) : prendre le Verrou et télécharger la liste (avec du réseau, de préférence la veille),
// état hors ligne, synchronisation, Verrou tenu par un autre appareil. Tous les messages reflètent un état réel (règle 13).
export function PanneauHorsLigne({ etat }: { etat: Etat }) {
  const t = useTranslations("Scan.horsLigne");
  const locale = useLocale();
  const heure = (iso: string) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU }).format(new Date(iso));
  const jourHeure = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: FUSEAU }).format(new Date(iso));

  if (etat.disponible === null) return null;
  if (etat.disponible === false) return <p className="t-small text-text-secondary">{t("indisponible")}</p>;

  const { liste, enLigne, occupe, info } = etat;
  const occupeSynchro = occupe === "synchro";
  const verrouPerdu = liste !== null && enLigne && (etat.etat === "libre" || etat.etat === "autre" || info?.type === "synchroPerdue");

  return (
    <section aria-labelledby="scan-hors-ligne" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="scan-hors-ligne" className="t-label">
        {t("titre")}
      </h2>

      {etat.etat === "autre" && !liste ? (
        <div role="status" className="flex flex-col gap-1">
          <p className="t-body font-bold">{t("reserve")}</p>
          <p className="t-small text-text-secondary">{t("reserveAide")}</p>
          {enLigne ? (
            <div>
              <Bouton variante="secondaire" onClick={() => void etat.reessayer()}>
                {t("reessayer")}
              </Bouton>
            </div>
          ) : null}
        </div>
      ) : null}

      {liste ? (
        <>
          <p className="t-small text-text-secondary">
            {enLigne
              ? t("tenu", { nombre: liste.liste.pass.length, heure: heure(liste.liste.genereLe), fin: jourHeure(liste.liste.expireLe) })
              : t("modeHorsLigne", { nombre: liste.liste.pass.length, heure: heure(liste.liste.genereLe) })}
          </p>
          <p className="t-small text-text-secondary">{t("enAttente", { nombre: etat.enAttente })}</p>
          {verrouPerdu ? <MessageEtat type="attention">{t("verrouPerdu")}</MessageEtat> : null}
          {enLigne ? (
            <div className="flex flex-wrap gap-3">
              {!verrouPerdu ? (
                <Bouton variante="secondaire" enCours={occupeSynchro} onClick={() => void etat.synchroniser()}>
                  {occupeSynchro ? t("synchroEnCours") : t("synchroniser")}
                </Bouton>
              ) : null}
              {verrouPerdu ? (
                <>
                  {etat.enAttente > 0 ? (
                    <Bouton variante="secondaire" enCours={occupeSynchro} onClick={() => void etat.synchroniser()}>
                      {occupeSynchro ? t("synchroEnCours") : t("synchroniserQuandMeme")}
                    </Bouton>
                  ) : null}
                  <Bouton variante="secondaire" onClick={() => void etat.effacer()}>
                    {t("effacer")}
                  </Bouton>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {!liste && etat.etat !== "autre" ? (
        enLigne ? (
          <>
            <p className="t-small text-text-secondary">{t("rappel")}</p>
            <div>
              <Bouton variante="secondaire" enCours={occupe === "prise"} onClick={() => void etat.prendre()}>
                {occupe === "prise" ? t("priseEnCours") : t("prendre")}
              </Bouton>
            </div>
          </>
        ) : (
          <MessageEtat type="attention">{t("sansVerrou")}</MessageEtat>
        )
      ) : null}

      <div aria-live="polite" className="flex flex-col gap-2">
        {info?.type === "prise" ? <MessageEtat type="succes">{t("prise")}</MessageEtat> : null}
        {info?.type === "erreurPrise" ? <MessageEtat type="erreur">{t(`erreurPrise.${info.erreur}`)}</MessageEtat> : null}
        {info?.type === "synchro" ? (
          <>
            <MessageEtat type="succes">{t("synchro.libere", { nombre: info.bilan.appliques })}</MessageEtat>
            {info.bilan.conflits + info.bilan.inconnus > 0 ? <MessageEtat type="attention">{t("synchro.conflits", { nombre: info.bilan.conflits + info.bilan.inconnus })}</MessageEtat> : null}
          </>
        ) : null}
        {info?.type === "synchroEchec" ? <MessageEtat type="attention">{t("synchro.echec")}</MessageEtat> : null}
        {info?.type === "synchroPerdue" ? <MessageEtat type="erreur">{t("synchro.perdue", { nombre: info.restants })}</MessageEtat> : null}
        {info?.type === "efface" ? <MessageEtat type="information">{t("efface")}</MessageEtat> : null}
      </div>
    </section>
  );
}
