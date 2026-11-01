import type { Auteur } from "@/lib/auth/auteur";

export type CodeErreurPanier =
  | "introuvable" // produit absent, dépublié ou sans prix
  | "indisponible" // taille épuisée ou Plafond atteint
  | "taille" // taille inconnue pour ce produit, ou taille donnée à un Kit
  | "quantite" // nombre hors de 1 à 10, ou cumul au-delà de 10
  | "gratuit" // Kit gratuit : seule offrir_commande l'ouvre
  | "deja_possede" // Kit déjà possédé par le Compte connecté
  | "ligne_unique" // une ligne de Kit n'a pas de quantité
  | "invalide"
  | "erreur";

export type ResultatPanier<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreurPanier };

// Une ligne telle que la base la relit à chaque affichage (jamais figée).
export type EtatLigne = "disponible" | "dernieres_pieces" | "sur_commande" | "complet" | "epuise";

export type LignePanier = {
  id: string;
  produitId: string;
  famille: "cosplay" | "accessoire" | "kit";
  slug: string;
  titre: string;
  taille: string | null;
  nombre: number;
  prixCents: number;
  etat: EtatLigne;
  delaiJours: number | null;
};

export type PanierLu = {
  lignes: LignePanier[];
  nombreArticles: number;
  // Somme des lignes disponibles ; les lignes « Plus disponible » n'y comptent pas.
  sousTotalCents: number;
  // Au moins une ligne n'est plus disponible : « Passer la commande » est bloqué.
  bloque: boolean;
};

export type LigneBrute = {
  ligne_id: string;
  produit_id: string;
  famille: string;
  slug: string;
  titre_fr: string;
  titre_en: string | null;
  taille: string | null;
  nombre: number;
  prix_cents: number | null;
  etat: string;
  delai_jours: number | null;
};

// Ce que le service attend de l'extérieur (en test, des faux nommés TEST_ les remplacent).
export type DependancesPanier = {
  // Valeur brute du cookie du Panier, ou null.
  lireCookie: () => Promise<string | null>;
  poserCookie: (valeur: string) => Promise<void>;
  // Secret de signature (PANIER_COOKIE_SECRET).
  secret: () => string;
  // Session vérifiée : identifiant du Compte connecté, ou null.
  compteId: () => Promise<string | null>;
  creerPanier: (auteur: Auteur) => Promise<{ id: string } | { erreur: string }>;
  ajouter: (e: { auteur: Auteur; panierId: string; compteId: string | null; produitId: string; taille: string | null; nombre: number }) => Promise<{ erreur: string | null }>;
  modifier: (e: { auteur: Auteur; panierId: string; ligneId: string; nombre: number }) => Promise<{ erreur: string | null }>;
  retirer: (e: { auteur: Auteur; panierId: string; ligneId: string }) => Promise<{ erreur: string | null }>;
  lire: (panierId: string) => Promise<{ lignes: LigneBrute[] } | { erreur: string }>;
  compter: (panierId: string) => Promise<{ nombre: number } | { erreur: string }>;
};
