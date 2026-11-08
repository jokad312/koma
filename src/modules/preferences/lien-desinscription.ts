import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { lireEnvPublique } from "@/lib/env";

// Lien de désinscription (story 9.4, FR-45) : signé par HMAC-SHA256 avec DESINSCRIPTION_SECRET, propre au destinataire, sans
// expiration (un email reste lisible longtemps). Le contexte « desinscription:v1: » sépare cet usage de tout autre.
const PREFIXE = "desinscription:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function secret(source: Record<string, string | undefined> = process.env): string {
  const valeur = source.DESINSCRIPTION_SECRET ?? "";
  // Le message nomme la variable, jamais sa valeur (règle 4).
  if (valeur.length < 32) throw new Error("Variable d'environnement absente ou trop courte : DESINSCRIPTION_SECRET. Voir .env.example.");
  return valeur;
}

export function signerDesinscription(compteId: string, source?: Record<string, string | undefined>): string {
  return createHmac("sha256", secret(source)).update(PREFIXE + compteId.toLowerCase()).digest("base64url");
}

export function verifierDesinscription(compteId: unknown, signature: unknown, source?: Record<string, string | undefined>): compteId is string {
  if (typeof compteId !== "string" || typeof signature !== "string" || !UUID.test(compteId) || signature.length > 100) return false;
  const attendue = Buffer.from(signerDesinscription(compteId, source));
  const recue = Buffer.from(signature);
  return attendue.length === recue.length && timingSafeEqual(attendue, recue);
}

// Adresse complète à mettre dans chaque Email commercial (stories 9.5 et 9.6), lue depuis NEXT_PUBLIC_SITE_URL (jamais en dur).
export function lienDesinscription(compteId: string, langue: "fr" | "en", source?: Record<string, string | undefined>): string {
  // Jamais un lien qui afficherait toujours « non valide ».
  if (!UUID.test(compteId.toLowerCase())) throw new Error("Identifiant de Compte invalide pour le lien de désinscription.");
  const site = lireEnvPublique().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  const params = new URLSearchParams({ c: compteId.toLowerCase(), s: signerDesinscription(compteId, source) });
  return `${site}/${langue}/desinscription?${params.toString()}`;
}
