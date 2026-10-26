import { contientMarqueur } from "@/lib/vitrine/marqueur";
import type { TailleFiche } from "./types";

// Fonctions pures de la fiche d'un produit (serveur et navigateur).

// Tailles proposées au choix : seulement celles qu'on peut acheter (disponibles, dernières pièces, ou fabriquées sur commande tant que la capacité le permet).
export function taillesChoisissables(tailles: readonly TailleFiche[]): TailleFiche[] {
  return tailles.filter((t) => t.etat === "disponible" || t.etat === "dernieres_pieces" || t.etat === "sur_commande");
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
