"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { appliquerAttributTheme, lireThemeMemorise } from "@/lib/theme/theme";
import { installerGardeTraduction } from "@/lib/dom/garde-traduction";
import { SCRIPT_TETE } from "@/lib/theme/script";

const nePasSuivre = () => () => {};
// Vrai pendant le rendu serveur et l'hydratation, faux pour un rendu purement client.
const estRenduServeur = () => true;
const estRenduClient = () => false;

// Script inline de <head> : il pose le thème avant le premier rendu.
// - Rendu serveur : le <script> est dans le HTML et s'exécute avant tout affichage.
// - Rendu purement client (en développement, la page 404 est rendue par le navigateur à partir d'une coquille vide) :
//   un <script> créé côté client ne s'exécute jamais et React avertit (« Encountered a script tag »).
//   On n'en crée donc pas ; l'effet ci-dessous pose le thème avant la première peinture de cette page.
// Le script installe aussi la garde contre la traduction du navigateur (bug A3) ; l'effet l'installe pour un rendu purement client
// (sans effet si le script l'a déjà fait). suppressHydrationWarning : le texte de la garde vient de toString(), qui peut différer
// entre le bundle serveur et le bundle client (minification) ; le script s'est déjà exécuté, son texte n'a plus d'effet.
export function ScriptTheme() {
  const serveur = useSyncExternalStore(nePasSuivre, estRenduClient, estRenduServeur);
  useLayoutEffect(() => {
    installerGardeTraduction(process.env.NODE_ENV !== "production");
    if (lireThemeMemorise() === "dark") appliquerAttributTheme("dark");
  }, []);
  if (!serveur) return null;
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCRIPT_TETE }} />;
}
