"use client";

import type { ReactNode } from "react";
import { useDansFenetre } from "./ui/FenetreFormulaire";

export const CLASSE_CHAMP = "t-body min-h-touch w-full rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary";
// Story 9.16 f (maquette D7 à D14) : dans une fenêtre de formulaire, champ sombre (jeton admin-champ) aux coins arrondis, étiquette en majuscules espacées.
// La bordure reste : sans elle, le champ ne se distingue pas assez du fond de la fenêtre.
export const CLASSE_CHAMP_FENETRE = "t-body min-h-touch w-full rounded-2xl border border-border-field bg-admin-champ px-4 py-3 text-text-primary";
export const CLASSE_ETIQUETTE = "t-label text-text-primary";
export const CLASSE_ETIQUETTE_FENETRE = "t-label uppercase tracking-[0.08em] text-text-primary";
// Case ou bouton radio dessiné (choix sélectionné : bordure rouge 2 px et coche, jamais la couleur seule).
const OPTION_BASE =
  "relative flex min-h-touch cursor-pointer items-center gap-3 border border-border-field px-4 py-3 has-[:checked]:border-2 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2";
export const CLASSE_OPTION = `${OPTION_BASE} rounded-md bg-surface`;
export const CLASSE_OPTION_FENETRE = `${OPTION_BASE} rounded-2xl bg-admin-champ`;

// Classes des champs selon l'endroit : fenêtre de formulaire (maquette) ou page ordinaire.
// « bloc » : cadre d'un groupe (taille, couleur, fichier, photo) ; dans la fenêtre, un simple contour sur le fond de la fenêtre.
export function useClassesChamp(): { champ: string; etiquette: string; option: string; bloc: string } {
  const fenetre = useDansFenetre();
  return fenetre
    ? { champ: CLASSE_CHAMP_FENETRE, etiquette: CLASSE_ETIQUETTE_FENETRE, option: CLASSE_OPTION_FENETRE, bloc: "rounded-2xl border border-border" }
    : { champ: CLASSE_CHAMP, etiquette: CLASSE_ETIQUETTE, option: CLASSE_OPTION, bloc: "rounded-lg border border-border bg-surface" };
}

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
  // Identifiant d'une <datalist> de suggestions (autocomplétion), champ d'une ligne seulement.
  liste?: string;
  // Contenu placé sous le message d'erreur (par exemple le bouton « Utiliser cette adresse »).
  sousLeChamp?: ReactNode;
};

// Champ de formulaire admin : libellé visible, aide, erreur sous le champ liée par aria-describedby, saisie contrôlée (jamais perdue).
export function ChampTexte({ id, libelle, aide, erreur, valeur, onChange, name, multiligne = false, inputMode, liste, sousLeChamp }: Props) {
  const classes = useClassesChamp();
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
    className: classes.champ,
  };
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className={classes.etiquette}>
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
        <input {...commun} type="text" inputMode={inputMode} list={liste} onChange={(e) => onChange(e.target.value)} />
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
