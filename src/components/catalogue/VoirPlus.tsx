"use client";

import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import { Link } from "@/i18n/navigation";

type Props = {
  // Même page, curseur de la suite : un vrai lien, qui fonctionne sans JavaScript.
  href: string;
  enCours: boolean;
  erreur: boolean;
  onCharger: () => void;
};

// « Voir plus » : un vrai lien <a> ; avec JavaScript, le clic simple charge la suite sur place
// (un clic avec Ctrl, Maj, Alt, Meta ou le bouton du milieu ouvre le lien normalement).
export function VoirPlus({ href, enCours, erreur, onCharger }: Props) {
  const t = useTranslations("Catalogue.voirPlus");

  function surClic(e: MouseEvent<HTMLAnchorElement>) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (!enCours) onCharger();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Link href={href} onClick={surClic} aria-disabled={enCours || undefined} className={CLASSES_SECONDAIRE}>
        {enCours ? t("enCours") : t("libelle")}
      </Link>
      {erreur ? (
        <p role="alert" className="t-small text-danger">
          {t("erreur")}
        </p>
      ) : null}
    </div>
  );
}
