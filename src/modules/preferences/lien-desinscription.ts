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

// Site et paramètres signés communs aux deux liens : jamais un lien qui afficherait toujours « non valide ».
function siteEtParametres(compteId: string, source?: Record<string, string | undefined>): { site: string; params: string } {
  if (!UUID.test(compteId.toLowerCase())) throw new Error("Identifiant de Compte invalide pour le lien de désinscription.");
  const site = lireEnvPublique().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  return { site, params: new URLSearchParams({ c: compteId.toLowerCase(), s: signerDesinscription(compteId, source) }).toString() };
}

// Adresse de la désinscription « en un clic » (RFC 8058) : en-tête List-Unsubscribe, appelée en POST par la messagerie.
export function lienDesinscriptionUnClic(compteId: string, source?: Record<string, string | undefined>): string {
  const { site, params } = siteEtParametres(compteId, source);
  return `${site}/api/desinscription?${params}`;
}

// Adresse de la page de confirmation, dans le corps de chaque Email commercial (stories 9.5 et 9.6), lue depuis NEXT_PUBLIC_SITE_URL.
export function lienDesinscription(compteId: string, langue: "fr" | "en", source?: Record<string, string | undefined>): string {
  const { site, params } = siteEtParametres(compteId, source);
  return `${site}/${langue}/desinscription?${params}`;
}
