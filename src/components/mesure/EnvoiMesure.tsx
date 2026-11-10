"use client";

import { useEffect } from "react";
import { estActionMesure } from "@/modules/mesure/actions";
import { demarrerMesure, mesurer } from "@/modules/mesure/client";

// Branchement de la mesure (story 9.7) : monté une fois dans le layout des langues. Prépare la session et l'origine, puis
// écoute les clics porteurs de « data-mesure » (bouton du héros) sans transformer les composants serveur en composants clients.
// N'affiche rien et n'ajoute aucune requête vers un domaine tiers.
export function EnvoiMesure() {
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
