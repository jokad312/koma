"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FermerMenuContexte } from "./MenuPanneau";

// Bouton rond « compte » de l'en-tête visiteur (story 9.12, décision 4) : icône personne, nom accessible « Se connecter » (visiteur) ou
// « Mon compte » (connecté). Il ouvre un petit panneau (motif « disclosure ») : connexion ou Mon espace et déconnexion, thème sombre, autre langue.
// Cible de 44 px ; Échap ferme et rend le focus au bouton ; un clic hors du panneau ou un changement de page le ferme.
export function MenuCompteRond({ connecte, children }: { connecte: boolean; children: ReactNode }) {
  const t = useTranslations("Navigation.menuCompte");
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const idPanneau = useId();

  const chemin = usePathname();
  const [cheminVu, setCheminVu] = useState(chemin);
  if (chemin !== cheminVu) {
    setCheminVu(chemin);
    setOuvert(false);
  }

  // Fermeture demandée par un contrôle du panneau (ex. « Se déconnecter ») : le panneau se ferme et le focus revient au bouton.
  const fermer = useCallback(() => {
    setOuvert(false);
    bouton.current?.focus();
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOuvert(false);
      // Le focus n'est rendu au bouton que s'il était dans la zone : ailleurs dans la page, il ne bouge pas.
      if (zone.current?.contains(document.activeElement)) bouton.current?.focus();
    };
    const surClic = (e: PointerEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("keydown", surTouche);
    document.addEventListener("pointerdown", surClic);
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.removeEventListener("pointerdown", surClic);
    };
  }, [ouvert]);

  return (
    <div ref={zone} className="menu-compte-rond relative">
      <button
        ref={bouton}
        type="button"
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        aria-label={connecte ? t("connecte") : t("visiteur")}
        onClick={() => setOuvert((o) => !o)}
        className="menu-compte-bouton inline-flex size-11 items-center justify-center rounded-full border border-current"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      </button>
      <div
        id={idPanneau}
        hidden={!ouvert}
        className="menu-compte-panneau absolute right-0 top-full z-40 mt-2 flex w-60 flex-col items-stretch gap-2 rounded-lg border border-border bg-surface p-3 text-text-primary shadow-lg"
      >
        <FermerMenuContexte value={fermer}>{children}</FermerMenuContexte>
      </div>
    </div>
  );
}
