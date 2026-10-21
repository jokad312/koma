"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ID_RACINE_PAGE } from "@/components/layout/constantes";
import { CLASSES_SECONDAIRE } from "./classes";

const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Jamais de boîtes de dialogue empilées (UX-DR15).
let dialogueOuvert = false;

type Props = {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  children: ReactNode;
  // « plein » : panneau opaque plein écran (menu ☰) ; « centre » : surface sur voile encre 60 %.
  variante?: "centre" | "plein";
  libelleFermer?: string;
  id?: string;
  // Élément qui reprend le focus à la fermeture (par défaut : celui qui l'avait à l'ouverture).
  retourFocus?: RefObject<HTMLElement | null>;
};

export function Dialogue({ ouvert, onFermer, titre, children, variante = "centre", libelleFermer, id, retourFocus }: Props) {
  const t = useTranslations("Composants");
  const idTitre = useId();
  const panneau = useRef<HTMLDivElement>(null);
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  });

  useEffect(() => {
    if (!ouvert) return;
    if (dialogueOuvert) {
      fermer.current();
      return;
    }
    dialogueOuvert = true;
    const retour = retourFocus?.current ?? (document.activeElement as HTMLElement | null);
    const racine = document.getElementById(ID_RACINE_PAGE);
    racine?.setAttribute("inert", "");
    const defilement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panneau.current?.querySelector<HTMLElement>(FOCALISABLES)?.focus();

    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        fermer.current();
        return;
      }
      if (e.key !== "Tab" || !panneau.current) return;
      const elements = [...panneau.current.querySelectorAll<HTMLElement>(FOCALISABLES)];
      if (elements.length === 0) return;
      const premier = elements[0];
      const dernier = elements[elements.length - 1];
      const actif = document.activeElement;
      if (e.shiftKey && (actif === premier || !panneau.current.contains(actif))) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && (actif === dernier || !panneau.current.contains(actif))) {
        e.preventDefault();
        premier.focus();
      }
    }
    document.addEventListener("keydown", surTouche);

    return () => {
      document.removeEventListener("keydown", surTouche);
      racine?.removeAttribute("inert");
      document.body.style.overflow = defilement;
      dialogueOuvert = false;
      retour?.focus();
    };
  }, [ouvert, retourFocus]);

  if (!ouvert || typeof document === "undefined") return null;

  const plein = variante === "plein";
  return createPortal(
    <div className={`fixed inset-0 z-50 ${plein ? "bg-background" : "flex items-center justify-center bg-scrim p-marge"}`}>
      <div
        ref={panneau}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        className={
          plein
            ? "flex h-full flex-col overflow-y-auto p-marge text-text-primary"
            : "max-h-full w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-6 text-text-primary"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onFermer} className={CLASSES_SECONDAIRE}>
            {libelleFermer ?? t("fermer")}
          </button>
        </div>
        <h2 id={idTitre} className="t-h3 mt-4">
          {titre}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
