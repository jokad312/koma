"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import type { Taille, TailleFiche } from "@/modules/catalogue/types";

const OPTION =
  "relative flex min-h-touch min-w-touch cursor-pointer items-center justify-center gap-2 rounded-md border border-border-field bg-surface px-4 py-3 text-text-primary has-[:checked]:border-2 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2";

type Props = {
  // Seulement les tailles qu'on peut choisir (disponibles, dernières pièces ou fabriquées sur commande).
  tailles: readonly TailleFiche[];
  choisie: Taille | null;
  onChoisir: (taille: Taille) => void;
};

// Radios natifs en groupe nommé (UX-DR23) : flèches du clavier, aucune sélection ne change de page ni ne déclenche d'action.
// L'état et le délai de la taille choisie se mettent à jour sur place, jamais avec une quantité.
export function SelecteurTaille({ tailles, choisie, onChoisir }: Props) {
  const t = useTranslations("Fiche.tailles");
  // Exhaustif : un état ajouté plus tard sans libellé ne compile pas (et complet ou epuise ne s'affiche jamais « Fabrication sur commande »).
  const libelleEtat = (x: TailleFiche): string => {
    switch (x.etat) {
      case "disponible":
        return t("enStock");
      case "dernieres_pieces":
        return t("dernieresPieces");
      case "sur_commande":
        return x.taille === "sur_mesure" ? t("surMesure") : t("surCommande");
      case "complet":
        return t("complet");
      case "epuise":
        return t("epuise");
      default: {
        const inattendu: never = x.etat;
        return inattendu;
      }
    }
  };
  const nom = useId();
  const courante = tailles.find((x) => x.taille === choisie) ?? null;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="t-small mb-2 font-semibold">{t("legende")}</legend>
      <div className="flex flex-wrap gap-2">
        {tailles.map((x) => (
          <label key={x.taille} className={OPTION}>
            <input
              type="radio"
              name={nom}
              value={x.taille}
              checked={choisie === x.taille}
              onChange={() => onChoisir(x.taille)}
              className="peer sr-only"
            />
            <svg aria-hidden="true" viewBox="0 0 16 16" className="hidden size-4 shrink-0 fill-none stroke-primary stroke-2 peer-checked:block">
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
            <span className="t-button">{x.taille === "sur_mesure" ? t("sur_mesure") : x.taille}</span>
          </label>
        ))}
      </div>
      <div role="status" className="t-small flex flex-col gap-1 text-text-primary">
        {courante ? (
          <>
            <p className="font-semibold">
              {libelleEtat(courante)}
            </p>
            {courante.etat === "sur_commande" && courante.delaiJours !== null ? <p>{t("delai", { n: courante.delaiJours })}</p> : null}
          </>
        ) : (
          <p className="text-text-secondary">{t("invite")}</p>
        )}
      </div>
    </fieldset>
  );
}
