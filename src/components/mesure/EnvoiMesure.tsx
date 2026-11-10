"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { estActionMesure } from "@/modules/mesure/actions";
import { demarrerMesure, mesurer, signalerNavigationInterne } from "@/modules/mesure/client";

// Branchement de la mesure (story 9.7) : monté une fois dans le layout des langues. Prépare la session et l'origine, puis
// écoute les clics porteurs de « data-mesure » (bouton du héros) sans transformer les composants serveur en composants clients.
// N'affiche rien et n'ajoute aucune requête vers un domaine tiers.
export function EnvoiMesure() {
  // Première page du document retenue ; tout changement de chemin ensuite est une navigation interne.
  const chemin = usePathname();
  const premier = useRef(chemin);
  useEffect(() => {
    if (chemin !== premier.current) signalerNavigationInterne();
  }, [chemin]);

  useEffect(() => {
    demarrerMesure();
    function surClic(evenement: MouseEvent) {
      const cible = evenement.target;
      if (!(cible instanceof Element)) return;
      const action = cible.closest("[data-mesure]")?.getAttribute("data-mesure") ?? "";
      if (estActionMesure(action)) mesurer(action);
    }
    document.addEventListener("click", surClic);
    return () => document.removeEventListener("click", surClic);
  }, []);
  return null;
}
