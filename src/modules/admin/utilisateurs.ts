import "server-only";
import type { AuteurCompte } from "@/lib/auth/auteur";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";

// Utilisateurs vus par l'Admin (story 9.10, lecture seule). Lecture par la fonction SQL lister_utilisateurs_admin, réservée au serveur et à l'Admin :
// l'email est masqué dans la base, l'adresse complète n'arrive jamais ici.
export type RoleUtilisateur = "admin" | "assistant" | "benevole";

export type UtilisateurAdmin = {
  id: string;
  // Nom des métadonnées de connexion ; null s'il n'y en a pas (la carte montre alors l'email masqué).
  nom: string | null;
  emailMasque: string | null;
  inscritLe: string | null;
  role: RoleUtilisateur | null;
  commandes: number;
  pass: number;
};

const ROLES: readonly string[] = ["admin", "assistant", "benevole"];

// Une erreur de lecture est relancée : jamais une liste vide inventée.
export async function lireUtilisateursAdmin(auteur: AuteurCompte): Promise<UtilisateurAdmin[]> {
  const { data, error } = await creerClientService().rpc("lister_utilisateurs_admin", { p_auteur: auteur as unknown as Json });
  if (error || !Array.isArray(data)) throw new Error("Lecture des utilisateurs impossible.");
  const utilisateurs: UtilisateurAdmin[] = [];
  for (const ligne of data) {
    if (!ligne || typeof ligne !== "object" || Array.isArray(ligne)) continue;
    const l = ligne as Record<string, unknown>;
    if (typeof l.id !== "string") continue;
    utilisateurs.push({
      id: l.id,
      nom: typeof l.nom === "string" ? l.nom : null,
      emailMasque: typeof l.email_masque === "string" ? l.email_masque : null,
      inscritLe: typeof l.inscrit_le === "string" ? l.inscrit_le : null,
      role: typeof l.role === "string" && ROLES.includes(l.role) ? (l.role as RoleUtilisateur) : null,
      commandes: typeof l.commandes === "number" ? l.commandes : 0,
      pass: typeof l.pass === "number" ? l.pass : 0,
    });
  }
  return utilisateurs;
}
