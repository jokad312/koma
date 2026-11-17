"use client";

import { useTranslations } from "next-intl";
import { FAMILLES_PRODUIT } from "@/modules/catalogue/types";
import type { FamilleProduit } from "@/modules/catalogue/types";
import { CLASSE_OPTION, useClassesChamp } from "./ChampTexte";

// Option dessinée d'une page ordinaire (gardée pour les formulaires hors fenêtre).
export const OPTION_RADIO = CLASSE_OPTION;

type Props = {
  base: string;
  famille: string;
  // Absent : la famille est fixe (produit existant), elle s'affiche sans choix.
  onChange?: (famille: FamilleProduit) => void;
  // Message d'erreur déjà traduit (création seulement).
  erreur?: string | null;
  // Vrai pendant un enregistrement : la famille ne change pas en plein envoi (story 9.16 f).
  desactive?: boolean;
};

// Choix de la famille d'un nouveau produit (cosplay, accessoire ou kit) ; pour un produit existant, la famille est affichée mais ne change plus.
export function ChoixFamille({ base, famille, onChange, erreur = null, desactive = false }: Props) {
  const t = useTranslations("Admin.produits.formulaire");
  const classes = useClassesChamp();

  if (!onChange) {
    return (
      <div className="flex flex-col gap-1">
        <p className={classes.etiquette}>{t("famille.libelle")}</p>
        <p className="t-body text-text-primary">{famille ? t(`famille.options.${famille as FamilleProduit}`) : ""}</p>
        <p className="t-small text-text-secondary">{t("famille.fixe")}</p>
      </div>
    );
  }

  return (
    <fieldset disabled={desactive} className="flex flex-col gap-2">
      <legend className={`${classes.etiquette} mb-2`}>{t("famille.libelle")}</legend>
      {FAMILLES_PRODUIT.map((valeur) => (
        <label key={valeur} className={classes.option}>
          <input
            type="radio"
            name="famille"
            value={valeur}
            checked={famille === valeur}
            onChange={() => onChange(valeur)}
            className="peer sr-only"
            aria-describedby={erreur ? `${base}-famille-erreur` : undefined}
          />
          <svg aria-hidden="true" viewBox="0 0 16 16" className="invisible size-4 shrink-0 fill-none stroke-primary stroke-2 peer-checked:visible">
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
          {t(`famille.options.${valeur}`)}
        </label>
      ))}
      {erreur ? (
        <p id={`${base}-famille-erreur`} className="t-small text-danger">
          {erreur}
        </p>
      ) : null}
    </fieldset>
  );
}
