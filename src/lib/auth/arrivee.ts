import type { Locale } from "@/i18n/routing";

// Rôle utile à l'arrivée : « admin » et « assistant » viennent du jeton (proxy) ou de la base (connexion) ; « benevole » de la base seulement,
// avec un accès de scan valide maintenant. Tout le reste est un client.
export type RoleArrivee = "admin" | "assistant" | "benevole" | null;

// Arrivée par défaut d'une personne connectée (story 9.12) : l'admin sur l'admin, l'assistant sur les Commandes, le bénévole qui a un accès
// de scan valide sur le Scan, tout autre Compte sur l'accueil de sa langue (option A, décision de Jonathan du 2026-11-13 ; l'espace personnel
// reste ouvert par « Mon compte »). Ce n'est qu'un aiguillage : chaque page revérifie le droit côté serveur.
export function arriveeParDefaut(role: RoleArrivee, locale: Locale): string {
  if (role === "admin") return `/${locale}/admin`;
  if (role === "assistant") return `/${locale}/admin/commandes`;
  if (role === "benevole") return `/${locale}/scan`;
  return `/${locale}`;
}

// Revendication `koma_role` posée dans le jeton par le crochet Supabase (migration 20270118100000) : admin ou assistant, sinon null
// (crochet non activé, client, valeur inattendue). Jamais une barrière : le proxy s'en sert seulement pour rediriger.
export function roleDuJeton(claims: unknown): "admin" | "assistant" | null {
  if (typeof claims !== "object" || claims === null) return null;
  const role = (claims as Record<string, unknown>).koma_role;
  return role === "admin" || role === "assistant" ? role : null;
}

// Le chemin de retour validé n'est qu'une page d'accueil de langue (« /fr », « /en/ », avec ou sans requête) : pas de retour précis,
// l'arrivée par défaut s'applique.
export function estAccueilDeLangue(chemin: string, locale: Locale): boolean {
  const sansRequete = chemin.split(/[?#]/, 1)[0];
  return sansRequete === `/${locale}` || sansRequete === `/${locale}/`;
}
