// Bug A3 (2026-11-22) : la traduction automatique du navigateur (ou une extension) remplace les nœuds texte de la page par ses propres
// éléments <font>. Quand React retire ou insère ensuite un nœud à côté d'un texte qu'il croit encore en place, le navigateur lève
// « NotFoundError: Failed to execute 'removeChild' / 'insertBefore' on 'Node' » et la page devient blanche.
// Parade connue (ticket React #11538) : removeChild et insertBefore tolèrent le seul cas « le nœud n'est pas (ou plus) enfant de ce
// parent ». Tout autre appel passe à l'original, sans rien changer (même valeur renvoyée, mêmes erreurs).
// - removeChild(n) avec n hors de ce parent : rien n'est retiré, n est renvoyé. Les <font> du traducteur restent affichés : le texte
//   que React voulait retirer reste visible (traduit) jusqu'au prochain rendu de cet élément ou au rechargement.
// - insertBefore(n, ref) avec ref hors de ce parent : n est ajouté en fin de parent (décision de Jonathan, option a) : rien n'est perdu ;
//   un texte peut apparaître au mauvais endroit jusqu'au prochain rendu. Si n est déjà enfant de ce parent (déplacement), il passe
//   lui aussi en fin de parent : l'ordre des enfants change jusqu'au prochain rendu.
// Un nœud est reconnu par son nodeType numérique, et non par instanceof Node, faux pour un nœud d'une autre fenêtre (iframe).
// Journal (journaliser vrai, en développement seulement) : l'opération et la balise du parent, jamais le contenu de la page.
//
// ATTENTION : cette fonction est aussi inlinée telle quelle dans <head> (SCRIPT_GARDE_TRADUCTION, via toString) : elle ne doit
// référencer aucun import ni aucune variable extérieure, et rester en JavaScript simple.
export function installerGardeTraduction(journaliser: boolean): void {
  if (typeof Node === "undefined") return;
  const proto = Node.prototype;
  // Drapeau porté par l'enveloppe elle-même : une seule installation, même si le script de <head> et l'effet client s'exécutent tous deux.
  if ((proto.removeChild as unknown as { gardeTraduction?: boolean }).gardeTraduction) return;
  const retirerOriginal = proto.removeChild;
  const insererOriginal = proto.insertBefore;
  const ajouterOriginal = proto.appendChild;
  const avertir = function (operation: string, parent: Node) {
    if (journaliser) console.warn("[dom] nœud déplacé par une traduction ou une extension :", operation, String(parent.nodeName).toLowerCase());
  };
  const retirer = function (this: Node, enfant: Node) {
    if (enfant != null && typeof enfant.nodeType === "number" && enfant.parentNode !== this) {
      avertir("removeChild", this);
      return enfant;
    }
    // eslint-disable-next-line prefer-rest-params
    return retirerOriginal.apply(this, arguments as unknown as [Node]);
  };
  const inserer = function (this: Node, nouveau: Node, reference: Node | null) {
    if (reference != null && typeof reference.nodeType === "number" && reference.parentNode !== this) {
      avertir("insertBefore", this);
      return ajouterOriginal.call(this, nouveau);
    }
    // eslint-disable-next-line prefer-rest-params
    return insererOriginal.apply(this, arguments as unknown as [Node, Node | null]);
  };
  (retirer as unknown as { gardeTraduction: boolean }).gardeTraduction = true;
  proto.removeChild = retirer as typeof proto.removeChild;
  proto.insertBefore = inserer as typeof proto.insertBefore;
}

// Forme inline, placée dans <head> avant le script du thème : installée avant l'hydratation. Le mode est fixé au rendu serveur.
export const SCRIPT_GARDE_TRADUCTION = `try{(${installerGardeTraduction.toString()})(${process.env.NODE_ENV !== "production"})}catch(e){}`;
