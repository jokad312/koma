"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Dialogue } from "@/components/ui/Dialogue";

const GLYPHE_MENU = "☰";

// Bouton ☰ et panneau opaque plein écran : dialogue modal, reste de la page inert, Échap ferme, focus rendu au bouton.
export function MenuPanneau({ children }: { children: ReactNode }) {
  const t = useTranslations("Menu");
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const idPanneau = useId();

  // Le choix d'une rubrique (ou de l'autre langue) ferme le menu.
  function surClic(e: MouseEvent<HTMLDivElement>) {
    // Un clic avec Ctrl, Meta, Maj ou le bouton du milieu ouvre un autre onglet : le menu reste ouvert.
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("a")) setOuvert(false);
  }

  // Le menu est réservé au mobile : il se ferme si la fenêtre passe à lg ou plus.
  useEffect(() => {
    if (!ouvert) return;
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 64rem)");
    const surChangement = () => mq.matches && setOuvert(false);
    surChangement();
    mq.addEventListener("change", surChangement);
    return () => mq.removeEventListener("change", surChangement);
  }, [ouvert]);

  return (
    <>
      <button
        ref={bouton}
        type="button"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idPanneau : undefined}
        aria-haspopup="dialog"
        onClick={() => setOuvert(true)}
        className="t-small inline-flex min-h-touch items-center gap-2 rounded-full border border-border-field bg-surface px-4 text-text-primary"
      >
        <span aria-hidden="true">{GLYPHE_MENU}</span>
        <span>{t("ouvrir")}</span>
      </button>
      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre={t("titre")}
        libelleFermer={t("fermer")}
        variante="plein"
        id={idPanneau}
        retourFocus={bouton}
      >
        <div onClick={surClic} className="flex flex-col items-start gap-4">
          {children}
        </div>
      </Dialogue>
    </>
  );
}
