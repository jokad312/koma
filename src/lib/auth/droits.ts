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

// Droit de scanner les Pass d'UN Événement (story 7.7, AD-13). L'Admin scanne pour tout Événement (droit « pass.scanner » de la matrice). Un autre
// Compte n'a AUCUN droit de la matrice : il scanne seulement si la base lui reconnaît, MAINTENANT, un accès bénévole valable pour CET Événement
// (acces_scan_valide, validité calculée à chaque appel : un accès échu est refusé même si la tâche de suppression n'a pas tourné). scanner_pass revérifie
// ensuite le même droit en base (scan_exiger_acces). Refus par défaut : toute erreur de vérification lève, jamais une ouverture.
export async function exigerAccesScan(evenementId: string): Promise<{ compteId: string; auteur: AuteurCompte }> {
  const session = await lireSessionVerifiee();
  if (!session) throw new DroitRefuseError("KS_NON_CONNECTE");
  const role = await lireRole(session.compteId);
  if (droitAutorise(role, "pass.scanner")) return { compteId: session.compteId, auteur: construireAuteur(session.compteId, role) };
  const { data, error } = await creerClientService().rpc("acces_scan_valide", { p_compte: session.compteId, p_evenement: evenementId });
  if (error) throw new DroitRefuseError("KS_VERIFICATION_IMPOSSIBLE");
  if (data !== true) throw new DroitRefuseError("KS_DROIT_REFUSE");
  return { compteId: session.compteId, auteur: construireAuteur(session.compteId, role ?? "benevole") };
}

// Page de Scan : visiteur envoyé vers la connexion avec retour ; sinon le Compte et son rôle (la page décide ensuite ce qu'il voit).
export async function exigerConnectePage(locale: string, chemin: string): Promise<{ compteId: string; role: RoleAuteur }> {
  const session = await lireSessionVerifiee();
  if (!session) redirect(`/${locale}/connexion?retour=${encodeURIComponent(`/${locale}${chemin}`)}`);
  return { compteId: session.compteId, role: await lireRole(session.compteId) };
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
