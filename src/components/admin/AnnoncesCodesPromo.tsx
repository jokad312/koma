"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// Annonces de la liste des Codes promo (story 9.16 i, correctif de revue) : une seule zone « status » pour toute la page, hors des lignes. Une ligne
// peut quitter la vue après une action (code désactivé sous le filtre ACTIFS) : son annonce ne doit pas disparaître avec elle, et le focus passe au
// compteur (jamais sur body). Le tableau et les cartes (sous 1024 px) partagent cette zone : jamais deux annonces pour une même action.
type Annoncer = (message: string, options?: { focusCompteur?: boolean }) => void;
const Contexte = createContext<Annoncer | null>(null);

export function useAnnonceCodesPromo(): Annoncer {
  return useContext(Contexte) ?? (() => {});
}

// compteur : texte du compteur (sert aussi à savoir quand la liste a été relue) ; affichage : le même compteur avec son nombre dans <Nombre>
// (exclu de la traduction du navigateur, A3-bis), affiché à sa place s'il est donné.
export function AnnoncesCodesPromo({ compteur, affichage, apresCompteur, children }: { compteur: string; affichage?: ReactNode; apresCompteur?: ReactNode; children: ReactNode }) {
  const [annonce, setAnnonce] = useState<{ message: string; focus: boolean; n: number } | null>(null);
  const refCompteur = useRef<HTMLParagraphElement>(null);
  // Après le rendu de la liste relue (router.refresh), le focus va au compteur ; une même annonce répétée est relue (n change la clé).
  useEffect(() => {
    if (annonce?.focus) refCompteur.current?.focus();
  }, [annonce, compteur]);
  const annoncer = useCallback<Annoncer>((message, options) => setAnnonce((a) => ({ message, focus: Boolean(options?.focusCompteur), n: (a?.n ?? 0) + 1 })), []);
  const valeur = useMemo(() => annoncer, [annoncer]);
  return (
    <Contexte.Provider value={valeur}>
      <div className="flex flex-wrap items-center gap-4">
        <p ref={refCompteur} tabIndex={-1} role="status" className="t-label uppercase text-text-primary">
          {affichage ?? compteur}
        </p>
        {apresCompteur}
      </div>
      <p role="status" className="t-body text-text-primary empty:hidden" data-annonce-codes="">
        {annonce ? <span key={annonce.n}>{annonce.message}</span> : null}
      </p>
      {children}
    </Contexte.Provider>
  );
}
