"use client";

import type { ReactNode } from "react";

export const CLASSE_CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";

type Props = {
  // Base des identifiants : le champ est `${id}`, l'aide `${id}-aide` et l'erreur `${id}-erreur`.
  id: string;
  libelle: string;
  aide?: string;
  // Message d'erreur déjà traduit ; le champ est alors marqué invalide et relié à ce message (aria-describedby).
  erreur?: string | null;
  valeur: string;
  onChange: (valeur: string) => void;
  name: string;
  multiligne?: boolean;
  inputMode?: "decimal" | "numeric";
  // Contenu placé sous le message d'erreur (par exemple le bouton « Utiliser cette adresse »).
  sousLeChamp?: ReactNode;
};

// Champ de formulaire admin : libellé visible, aide, erreur sous le champ liée par aria-describedby, saisie contrôlée (jamais perdue).
export function ChampTexte({ id, libelle, aide, erreur, valeur, onChange, name, multiligne = false, inputMode, sousLeChamp }: Props) {
  const idAide = `${id}-aide`;
  const idErreur = `${id}-erreur`;
  const decrit = [aide ? idAide : null, erreur ? idErreur : null].filter(Boolean).join(" ") || undefined;
  const commun = {
    id,
    name,
    value: valeur,
    autoComplete: "off",
    "aria-invalid": erreur ? (true as const) : undefined,
    "aria-describedby": decrit,
    className: CLASSE_CHAMP,
  };
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="t-label text-text-primary">
        {libelle}
      </label>
      {aide ? (
        <p id={idAide} className="t-small text-text-secondary">
          {aide}
        </p>
      ) : null}
      {multiligne ? (
        <textarea {...commun} rows={5} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...commun} type="text" inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      )}
      {erreur ? (
        <p id={idErreur} className="t-small text-danger">
          {erreur}
        </p>
      ) : null}
      {sousLeChamp}
    </div>
  );
}
