// Classes partagées par les boutons. Bouton principal : fond rouge #E3261C, texte #FFFFFF (jamais crème).
const BASE =
  "t-button inline-flex min-h-touch items-center justify-center gap-2 rounded-full px-5 py-3 text-center no-underline";

export const CLASSES_PRINCIPAL = `${BASE} bg-primary text-on-primary`;
export const CLASSES_SECONDAIRE = `${BASE} border border-border-field bg-surface text-text-primary`;
// Désactivé : surface, contour de contrôle, texte secondaire. Jamais d'opacité réduite ni de rouge plus clair.
export const CLASSES_DESACTIVE = `${BASE} border border-border-field bg-surface text-text-secondary`;
