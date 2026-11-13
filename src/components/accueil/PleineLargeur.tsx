"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Donne à son contenu toute la largeur de la fenêtre, depuis l'intérieur de la page (la mise en page commune n'est pas touchée).
// 100vw compterait la barre de défilement verticale (sous Windows) et ferait défiler la page de côté : la largeur utile du document
// (clientWidth) est donc mesurée ici et posée dans --pleine-largeur ; avant l'hydratation, 100vw sert de repli.
export function PleineLargeur({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const racine = document.documentElement;
    const poser = () => element.style.setProperty("--pleine-largeur", `${racine.clientWidth}px`);
    poser();
    const observateur = new ResizeObserver(poser);
    observateur.observe(racine);
    return () => observateur.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
