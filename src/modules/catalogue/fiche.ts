import { contientMarqueur } from "@/lib/vitrine/marqueur";
import { DISPONIBILITES, type CouleurFiche, type TailleFiche } from "./types";

// Fonctions pures de la fiche d'un produit (serveur et navigateur).

// Tailles proposées au choix : seulement celles qu'on peut acheter (disponibles, dernières pièces, ou fabriquées sur commande tant que la capacité le permet).
export function taillesChoisissables(tailles: readonly TailleFiche[]): TailleFiche[] {
  return tailles.filter((t) => t.etat === "disponible" || t.etat === "dernieres_pieces" || t.etat === "sur_commande");
}

// Couleurs d'un Vêtement, sans doublon, dans l'ordre de la base (taille puis nom français) ; vide hors Vêtement en couleurs.
export function couleursDistinctes(tailles: readonly TailleFiche[]): CouleurFiche[] {
  const vues = new Map<string, CouleurFiche>();
  for (const t of tailles) if (t.couleur && !vues.has(t.couleur.cle)) vues.set(t.couleur.cle, t.couleur);
  return [...vues.values()];
}

// Choix proposés pour un Vêtement en plusieurs couleurs. Avec une couleur choisie : seulement les tailles qui existent et s'achètent dans
// cette couleur, avec l'état et le délai de leur variante. Sans couleur choisie : chaque taille achetable dans au moins une couleur, une
// seule fois, avec son meilleur état. Jamais une quantité.
export function taillesPourCouleur(tailles: readonly TailleFiche[], couleur: string | null): TailleFiche[] {
  const achetables = taillesChoisissables(tailles);
  const ordre: TailleFiche["taille"][] = [];
  for (const t of achetables) if (!ordre.includes(t.taille)) ordre.push(t.taille);
  return ordre.map((taille) => {
    if (couleur === null) {
      const rang = (t: TailleFiche) => DISPONIBILITES.indexOf(t.etat);
      return achetables.filter((t) => t.taille === taille).reduce((a, b) => (rang(b) < rang(a) ? b : a));
    }
    return achetables.find((t) => t.taille === taille && t.couleur?.cle === couleur) ?? null;
  }).filter((t): t is TailleFiche => t !== null);
}

// Le Plafond de fabrication est atteint dès qu'une taille n'est plus que « complet » (fabrication possible mais capacité atteinte).
export function capaciteAtteinte(tailles: readonly TailleFiche[]): boolean {
  return tailles.some((t) => t.etat === "complet");
}

// Disponibilité schema.org de l'offre, calculée à la requête : en stock (disponible ou dernières pièces), sinon fabriquée sur commande,
// sinon hors stock (complet ou épuisé).
export type DisponibiliteSchema = "https://schema.org/InStock" | "https://schema.org/MadeToOrder" | "https://schema.org/OutOfStock";

export function disponibiliteSchema(tailles: readonly TailleFiche[]): DisponibiliteSchema {
  if (tailles.some((t) => t.etat === "disponible" || t.etat === "dernieres_pieces")) return "https://schema.org/InStock";
  if (tailles.some((t) => t.etat === "sur_commande")) return "https://schema.org/MadeToOrder";
  return "https://schema.org/OutOfStock";
}

// Description pour les métadonnées : espaces simplifiés, coupée à la fin d'un mot avec « … ». Le marqueur « [Texte à fournir] » donne null
// (l'appelant utilise alors son texte de repli) ; jamais de texte inventé ici.
export function tronquerDescription(texte: string | null, max = 160): string | null {
  if (!texte) return null;
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre === "" || contientMarqueur(propre)) return null;
  if (propre.length <= max) return propre;
  const coupe = propre.slice(0, max - 1);
  const dernierEspace = coupe.lastIndexOf(" ");
  const base = dernierEspace > max / 2 ? coupe.slice(0, dernierEspace) : coupe;
  return `${base.replace(/[\s.,;:!?-]+$/u, "")}…`;
}
