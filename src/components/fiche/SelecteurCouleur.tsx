"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import type { CouleurFiche } from "@/modules/catalogue/types";
import { OPTION } from "./SelecteurTaille";

type Props = {
  // Couleurs du Vêtement (au moins deux : avec une seule, la fiche écrit son nom sans sélecteur).
  couleurs: readonly CouleurFiche[];
  // Clé (nom français) de la couleur choisie, ou null.
  choisie: string | null;
  onChoisir: (cle: string) => void;
};

// Radios natifs en groupe nommé, comme le sélecteur de tailles : flèches du clavier, aucune action au choix. Le nom de la couleur est
// toujours écrit (nom accessible du bouton) ; la pastille n'est qu'un repère visuel, masquée aux lecteurs d'écran.
export function SelecteurCouleur({ couleurs, choisie, onChoisir }: Props) {
  const t = useTranslations("Fiche.couleurs");
  const nom = useId();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="t-small mb-2">{t("legende")}</legend>
      <div className="flex flex-wrap gap-2">
        {couleurs.map((c) => (
          <label key={c.cle} className={OPTION}>
            <input type="radio" name={nom} value={c.cle} checked={choisie === c.cle} onChange={() => onChoisir(c.cle)} className="peer sr-only" />
            <svg aria-hidden="true" viewBox="0 0 16 16" className="hidden size-4 shrink-0 fill-none stroke-primary stroke-2 peer-checked:block">
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
            {c.hex ? <span aria-hidden="true" className="inline-block size-5 shrink-0 rounded-full border border-border-field" style={{ backgroundColor: c.hex }} /> : null}
            <span className="t-button">{c.nom}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
