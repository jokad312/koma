"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

// Pastille de filtre de l'admin (story 9.16 b, maquettes B5, CB4, CP4 ; décision Q16). L'état actif ne dépend pas que de la couleur : la pastille active
// est pleine (fond « filtre ») avec un contour de 2 px, l'inactive n'a qu'un contour fin sur fond transparent. État annoncé : aria-pressed (bouton) ou
// aria-current (lien, quand le filtre est porté par l'adresse de la page).
const BASE = "t-label inline-flex min-h-touch items-center justify-center rounded-full px-4 no-underline";
export const CLASSES_FILTRE_ACTIF = `${BASE} border-2 border-text-primary bg-admin-filtre text-admin-sur-filtre`;
export const CLASSES_FILTRE_INACTIF = `${BASE} border border-border-field bg-transparent text-text-primary`;

type Props = { actif: boolean; children: ReactNode } & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

export function PastilleFiltre(props: Props) {
  const classes = props.actif ? CLASSES_FILTRE_ACTIF : CLASSES_FILTRE_INACTIF;
  if (props.href !== undefined) {
    return (
      <Link href={props.href} aria-current={props.actif ? "true" : undefined} className={classes}>
        {props.children}
      </Link>
    );
  }
  return (
    <button type="button" aria-pressed={props.actif} onClick={props.onClick} className={classes}>
      {props.children}
    </button>
  );
}
