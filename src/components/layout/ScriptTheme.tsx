"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { appliquerAttributTheme, lireThemeMemorise } from "@/lib/theme/theme";
import { SCRIPT_THEME } from "@/lib/theme/script";

const nePasSuivre = () => () => {};
// Vrai pendant le rendu serveur et l'hydratation, faux pour un rendu purement client.
const estRenduServeur = () => true;
const estRenduClient = () => false;

// Script inline de <head> : il pose le thème avant le premier rendu.
// - Rendu serveur : le <script> est dans le HTML et s'exécute avant tout affichage.
// - Rendu purement client (en développement, la page 404 est rendue par le navigateur à partir d'une coquille vide) :
//   un <script> créé côté client ne s'exécute jamais et React avertit (« Encountered a script tag »).
//   On n'en crée donc pas ; l'effet ci-dessous pose le thème avant la première peinture de cette page.
export function ScriptTheme() {
  const serveur = useSyncExternalStore(nePasSuivre, estRenduClient, estRenduServeur);
  useLayoutEffect(() => {
    if (lireThemeMemorise() === "dark") appliquerAttributTheme("dark");
  }, []);
  if (!serveur) return null;
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />;
}
