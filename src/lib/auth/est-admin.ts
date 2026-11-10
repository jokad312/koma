import "server-only";
import { cache } from "react";
import { lireSessionVerifiee } from "./compte";
import { lireRole } from "./droits";

// Le lien « Administration » du menu public n'est qu'un confort : la vraie barrière reste exigerAdminPage sur chaque page admin.
// Rôle lu en base (a_le_role), jamais depuis le navigateur. Seul le rôle Admin voit le lien. Toute erreur de lecture = pas de lien (jamais un faux « oui »).
// cache() : l'en-tête et le panneau ☰ posent la question dans la même requête, une seule lecture.
export const estAdminConnecte = cache(async (): Promise<boolean> => {
  try {
    const session = await lireSessionVerifiee();
    if (!session) return false;
    return (await lireRole(session.compteId)) === "admin";
  } catch {
    return false;
  }
});
