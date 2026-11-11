"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import type { RaisonRefus } from "@/modules/scan/types";

type Props =
  | { type: "valide"; nom: string; evenement: string; typePass: string; onSuivant: () => void }
  | { type: "refuse"; raison: RaisonRefus; heure: string | null; onSuivant: () => void };

// Résultat plein écran (UX-DR41) : couleurs fixes, identiques dans les deux thèmes ; le mot, la grande icône et la couleur disent la même chose
// (jamais la couleur seule). Annoncé en role="alert" ; aucun son. Le bouton « Scanner le pass suivant » reçoit le focus.
export function ResultatPlein(props: Props) {
  const t = useTranslations("Scan");
  const bouton = useRef<HTMLButtonElement>(null);
  useEffect(() => bouton.current?.focus(), []);
  const idTitre = useId();
  const valide = props.type === "valide";

  return (
    <div
      data-resultat-scan={props.type}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitre}
      // Le reste de la page est inerte ; Tab reste sur l'unique bouton, Échap équivaut à « Scanner le pass suivant ».
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          bouton.current?.focus();
        } else if (e.key === "Escape") {
          props.onSuivant();
        }
      }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between gap-6 overflow-y-auto p-6 text-center text-scan-texte ${valide ? "bg-scan-valide" : "bg-scan-refuse"}`}
    >
      <div role="alert" className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-32 shrink-0 fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {valide ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
        </svg>
        <p id={idTitre} className="font-condensee text-6xl font-bold leading-none tracking-wide">{valide ? t("resultat.valide") : t("resultat.refuse")}</p>
        {props.type === "valide" ? (
          <dl className="flex w-full flex-col gap-4">
            <div>
              <dt className="t-small">{t("resultat.type")}</dt>
              <dd className="font-condensee text-4xl font-bold leading-tight">{props.typePass}</dd>
            </div>
            <div>
              <dt className="t-small">{t("resultat.nom")}</dt>
              <dd className="text-3xl font-bold leading-tight break-words">{props.nom}</dd>
            </div>
            <div>
              <dt className="t-small">{t("resultat.evenement")}</dt>
              <dd className="t-body break-words">{props.evenement}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-2xl font-bold leading-snug">
            {props.raison === "deja_scanne"
              ? props.heure
                ? t("raison.deja_scanne", { heure: props.heure })
                : t("raison.deja_scanne_sans_heure")
              : t(`raison.${props.raison}`)}
          </p>
        )}
      </div>
      <button
        ref={bouton}
        type="button"
        onClick={props.onSuivant}
        className="t-button min-h-touch w-full max-w-md rounded-full bg-scan-texte px-5 py-4"
        style={{ color: valide ? "var(--ks-scan-valide)" : "var(--ks-scan-refuse)" }}
      >
        {t("resultat.suivant")}
      </button>
    </div>
  );
}
