"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "@/i18n/navigation";

type Props = {
  // Libellé du bouton (« Boutique » / « Shop »), déjà traduit.
  libelle: string;
  // Liens des catalogues, adresses déjà propres à la langue et libellés déjà traduits.
  liens: readonly { href: string; libelle: string }[];
};

// Entrée « Boutique » de l'en-tête (ordinateur) : bouton qui ouvre un panneau de liens (motif bouton + panneau, pas un role="menu").
// aria-expanded et aria-controls sur le bouton ; Échap ferme et rend le focus au bouton ; un clic à côté ferme ; Tab sort normalement
// (le panneau se ferme quand le focus le quitte) ; le choix d'un lien ferme le panneau. Cible de 44 px.
export function MenuBoutique({ libelle, liens }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const idPanneau = useId();
  const racine = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);

  // Clic à côté : le panneau se ferme.
  useEffect(() => {
    if (!ouvert) return;
    function surClic(e: MouseEvent) {
      if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, [ouvert]);

  function surTouche(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && ouvert) {
      e.preventDefault();
      setOuvert(false);
      bouton.current?.focus();
    }
  }

  return (
    <div
      ref={racine}
      className="relative"
      onKeyDown={surTouche}
      onBlur={(e) => {
        if (!racine.current?.contains(e.relatedTarget as Node | null)) setOuvert(false);
      }}
    >
      <button
        ref={bouton}
        type="button"
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        onClick={() => setOuvert((v) => !v)}
        className="t-h3 inline-flex min-h-touch items-center gap-2 text-text-primary"
      >
        {libelle}
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`size-4 fill-none stroke-current stroke-2 ${ouvert ? "rotate-180" : ""}`}>
          <path d="M3.5 6 8 10.5 12.5 6" />
        </svg>
      </button>
      <div id={idPanneau} hidden={!ouvert} className="absolute left-0 top-full z-40 mt-2 min-w-56 rounded-lg border border-border bg-surface p-2">
        <ul className="flex flex-col">
          {liens.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOuvert(false)}
                className="t-body flex min-h-touch items-center rounded-md px-3 text-text-primary underline-offset-4 hover:underline"
              >
                {l.libelle}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
