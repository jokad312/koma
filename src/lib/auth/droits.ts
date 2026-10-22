import "server-only";
import { notFound, redirect } from "next/navigation";
import { creerClientService } from "@/lib/supabase/service";
import { lireSessionVerifiee } from "./compte";
import { construireAuteur, type AuteurCompte, type RoleAuteur } from "./auteur";
import { droitAutorise, type Droit } from "./matrice-droits";

export { DROITS, DROITS_ASSISTANT, droitAutorise, type Droit } from "./matrice-droits";

export class DroitRefuseError extends Error {
  constructor(readonly code: "KS_NON_CONNECTE" | "KS_DROIT_REFUSE" | "KS_VERIFICATION_IMPOSSIBLE") {
    super(code);
  }
}

// Rôle du Compte, lu en base par a_le_role (seule source de vérité) : jamais depuis le navigateur ni les métadonnées de session.
// Un rôle plus fort passe avant : admin, puis assistant, puis bénévole.
export async function lireRole(compteId: string): Promise<RoleAuteur> {
  const client = creerClientService();
  for (const role of ["admin", "assistant", "benevole"] as const) {
    const { data, error } = await client.rpc("a_le_role", { p_compte: compteId, p_role: role });
    if (error) throw new DroitRefuseError("KS_VERIFICATION_IMPOSSIBLE");
    if (data === true) return role;
  }
  return null;
}

// Vérification serveur d'un droit, à appeler au début de chaque action d'écriture. Refus par défaut.
export async function exigerDroit(droit: Droit): Promise<{ compteId: string; auteur: AuteurCompte }> {
  const session = await lireSessionVerifiee();
  if (!session) throw new DroitRefuseError("KS_NON_CONNECTE");
  const role = await lireRole(session.compteId);
  if (!droitAutorise(role, droit)) throw new DroitRefuseError("KS_DROIT_REFUSE");
  return { compteId: session.compteId, auteur: construireAuteur(session.compteId, role) };
}

// Vérification de chaque page admin (le layout ne suffit pas) : visiteur envoyé vers la connexion avec retour,
// Compte sans le droit : 404. Une vérification impossible lève une erreur (jamais une ouverture par défaut).
export async function exigerAdminPage(locale: string, chemin: string, droit: Droit = "admin.acceder"): Promise<{ compteId: string; auteur: AuteurCompte }> {
  try {
    return await exigerDroit(droit);
  } catch (e) {
    if (e instanceof DroitRefuseError) {
      if (e.code === "KS_NON_CONNECTE") redirect(`/${locale}/connexion?retour=${encodeURIComponent(`/${locale}${chemin}`)}`);
      if (e.code === "KS_DROIT_REFUSE") notFound();
    }
    throw e;
  }
}
