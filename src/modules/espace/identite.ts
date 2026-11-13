import "server-only";
import { connection } from "next/server";
import { creerClientSession } from "@/lib/supabase/session";
import { pseudoDepuisClaims } from "./pseudo";

// Session vérifiée (getClaims) et pseudo de la personne, lus à chaque requête pour l'espace personnel. null sans session valide.
export async function lireIdentiteEspace(): Promise<{ compteId: string; pseudo: string | null } | null> {
  await connection();
  const client = await creerClientSession();
  const { data, error } = await client.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string" || sub.length === 0) return null;
  return { compteId: sub, pseudo: pseudoDepuisClaims(data?.claims) };
}
