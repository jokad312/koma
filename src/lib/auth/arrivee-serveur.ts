import "server-only";
import type { Locale } from "@/i18n/routing";
import { creerClientService } from "@/lib/supabase/service";
import { arriveeParDefaut, estAccueilDeLangue, type RoleArrivee } from "./arrivee";
import { lireSessionVerifiee } from "./compte";
import { lireRole } from "./droits";

// Bénévole : Compte qui a, maintenant, au moins un accès de scan valide (table acces_benevole, validité calculée par la base).
// Toute erreur vaut « non ». Ce n'est qu'un aiguillage : la page de Scan et chaque scan revérifient l'accès.
export async function accesScanValideMaintenant(compteId: string): Promise<boolean> {
  const { data, error } = await creerClientService().rpc("lire_acces_benevole_compte", { p_compte: compteId });
  if (error || !Array.isArray(data)) return false;
  return data.some((a) => a.valide === true);
}

// Rôle d'arrivée lu en base à la connexion (une seule fois, pas à chaque page). Toute erreur de lecture : client (/compte), jamais l'admin.
export async function lireRoleArrivee(compteId: string): Promise<RoleArrivee> {
  try {
    const role = await lireRole(compteId);
    if (role === "admin" || role === "assistant") return role;
    if (await accesScanValideMaintenant(compteId)) return "benevole";
    return null;
  } catch {
    console.error("[connexion] lecture du rôle d'arrivée impossible : espace personnel");
    return null;
  }
}

// Destination après la connexion (story 9.12) : un retour précis (Panier, Commande, page quittée), déjà validé par cheminRetourValide, passe
// toujours avant ; sans retour précis (accueil de la langue), l'arrivée par défaut selon le rôle. Sans session vérifiée : le retour tel quel.
export async function destinationApresConnexion(retourValide: string, locale: Locale, compteId?: string): Promise<string> {
  if (!estAccueilDeLangue(retourValide, locale)) return retourValide;
  const id = compteId ?? (await lireSessionVerifiee())?.compteId;
  if (!id) return retourValide;
  return arriveeParDefaut(await lireRoleArrivee(id), locale);
}
