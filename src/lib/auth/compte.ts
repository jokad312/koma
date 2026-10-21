import "server-only";
import { connection } from "next/server";
import { creerClientService } from "@/lib/supabase/service";
import { creerClientSession } from "@/lib/supabase/session";
import { construireAuteur, type Auteur } from "./auteur";

export type SessionVerifiee = { compteId: string };

export class CompteRefuseError extends Error {
  constructor(
    readonly code: "KS_NON_CONNECTE" | "KS_COMPTE_INCOMPLET" | "KS_VERIFICATION_IMPOSSIBLE",
  ) {
    super(code);
  }
}

// Session lue dans les cookies et vérifiée par Supabase (getClaims) ; null sans session valide.
export async function lireSessionVerifiee(): Promise<SessionVerifiee | null> {
  // getClaims lit l'heure pour vérifier l'expiration : sans cet appel explicite, Next 16 refuse de préparer la route à l'avance
  // (blocking-prerender-current-time). La session est toujours lue au moment de la requête.
  await connection();
  const client = await creerClientSession();
  const { data, error } = await client.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string" || sub.length === 0) return null;
  return { compteId: sub };
}

// Aide serveur de toute action d'achat, de Pass ou d'envoi de photo : un Compte sans âge déclaré est refusé (AD-24).
export async function exigerCompteComplet(): Promise<{ compteId: string; auteur: Auteur }> {
  const session = await lireSessionVerifiee();
  if (!session) throw new CompteRefuseError("KS_NON_CONNECTE");
  const { data, error } = await creerClientService().rpc("compte_complet", { p_compte: session.compteId });
  if (error) throw new CompteRefuseError("KS_VERIFICATION_IMPOSSIBLE");
  if (data !== true) throw new CompteRefuseError("KS_COMPTE_INCOMPLET");
  return { compteId: session.compteId, auteur: construireAuteur(session.compteId) };
}

export type EtatCompte = "anonyme" | "incomplet" | "complet";

// Pour la page de connexion : où en est le visiteur ? Toute erreur vaut « anonyme » (la page reste utilisable).
export async function lireEtatCompte(): Promise<EtatCompte> {
  try {
    const session = await lireSessionVerifiee();
    if (!session) return "anonyme";
    const { data, error } = await creerClientService().rpc("compte_complet", { p_compte: session.compteId });
    if (error) return "anonyme";
    return data === true ? "complet" : "incomplet";
  } catch {
    return "anonyme";
  }
}
