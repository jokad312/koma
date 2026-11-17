import type { ProduitLien } from "./types";

// Story 9.16 e) : produits proposés au sélecteur « produit lié » d'un article. Un produit archivé n'est plus proposé, sauf celui déjà lié à
// l'article (sa valeur actuelle reste affichée et conservée à l'enregistrement).
export function produitsPourLien(produits: ReadonlyArray<{ id: string; titreFr: string; archiveLe: string | null }>, dejaLie: string | null = null): ProduitLien[] {
  return produits.filter((p) => p.archiveLe === null || p.id === dejaLie).map((p) => ({ id: p.id, titreFr: p.titreFr }));
}
