"use client";

import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Link } from "@/i18n/navigation";

type Textes = {
  libelle: string;
  enCours: string;
  // Message d'erreur facultatif : sans lui, celui du catalogue est utilisé (déjà approuvé).
  erreur?: string;
};

type Props = {
  // Même page, curseur de la suite : un vrai lien, qui fonctionne sans JavaScript.
  href: string;
  enCours: boolean;
  erreur: boolean;
  onCharger: () => void;
  // Textes propres à une liste (Blog) ; par défaut, ceux du catalogue.
  textes?: Textes;
};

// « Voir plus » : un vrai lien <a> ; avec JavaScript, le clic simple charge la suite sur place
// (un clic avec Ctrl, Maj, Alt, Meta ou le bouton du milieu ouvre le lien normalement).
export function VoirPlus({ href, enCours, erreur, onCharger, textes }: Props) {
  const t = useTranslations("Catalogue.voirPlus");
  const libelle = textes?.libelle ?? t("libelle");
  const libelleEnCours = textes?.enCours ?? t("enCours");
  const messageErreur = textes?.erreur ?? t("erreur");

  function surClic(e: MouseEvent<HTMLAnchorElement>) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (!enCours) onCharger();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Link href={href} onClick={surClic} aria-disabled={enCours || undefined} className={CLASSES_SECONDAIRE}>
        {enCours ? libelleEnCours : libelle}
      </Link>
      {erreur ? (
        <p role="alert" className="t-small text-danger">
          {messageErreur}
        </p>
      ) : null}
    </div>
  );
}
