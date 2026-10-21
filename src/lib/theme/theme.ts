// Thème « Sumi & washi » : crème par défaut, sombre au choix (UX-DR7).
// L'attribut data-theme est posé sur <html> avant le premier rendu par SCRIPT_THEME ; ce module le change ensuite.

export const CLE_STOCKAGE_THEME = "ks-theme";
export const ATTRIBUT_THEME = "data-theme";

export type Theme = "light" | "dark";

// Le stockage peut être inaccessible (fenêtre privée, navigateur intégré) : le thème crème s'applique alors.
export function lireThemeMemorise(): Theme {
  try {
    return window.localStorage.getItem(CLE_STOCKAGE_THEME) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function appliquerTheme(theme: Theme): void {
  document.documentElement.setAttribute(ATTRIBUT_THEME, theme);
  try {
    window.localStorage.setItem(CLE_STOCKAGE_THEME, theme);
  } catch {
    // Choix non mémorisé : sans conséquence, le thème reste appliqué pour la page en cours.
  }
}

export function themeActuel(): Theme {
  return document.documentElement.getAttribute(ATTRIBUT_THEME) === "dark" ? "dark" : "light";
}
