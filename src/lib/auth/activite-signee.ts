import { createHmac, timingSafeEqual } from "node:crypto";

// Cookie d'activité signé (story 9.14, décision de Jonathan du 2026-11-13) : « <heure en ms>.<signature> ». La signature HMAC-SHA256
// (ACTIVITE_COOKIE_SECRET) porte sur l'heure ET sur la session Supabase (session_id du jeton, sinon le Compte) : une heure fabriquée
// dans le navigateur, ou le cookie d'une autre session, est refusée. Le cookie ne contient aucune donnée personnelle.
const LONGUEUR_MIN_SECRET = 32;
const HEURE = /^[0-9]{10,14}$/;

// Secret lu dans l'environnement, jamais de valeur de repli (règle 4) : null s'il manque ou s'il est trop court (le proxy le signale).
export function lireSecretActivite(source: Record<string, string | undefined> = process.env): string | null {
  const secret = source.ACTIVITE_COOKIE_SECRET;
  return secret && secret.length >= LONGUEUR_MIN_SECRET ? secret : null;
}

// Identifiant de la session à laquelle le cookie est lié : session_id du jeton Supabase, sinon le Compte (sub).
export function lienSession(claims: unknown): string | null {
  if (typeof claims !== "object" || claims === null) return null;
  const c = claims as Record<string, unknown>;
  if (typeof c.session_id === "string" && c.session_id) return c.session_id;
  return typeof c.sub === "string" && c.sub ? c.sub : null;
}

// Heure de connexion (ms) d'après le jeton (amr : méthode et heure de l'authentification, en secondes) : la plus récente, sinon null.
export function heureConnexion(claims: unknown): number | null {
  if (typeof claims !== "object" || claims === null) return null;
  const amr = (claims as Record<string, unknown>).amr;
  if (!Array.isArray(amr)) return null;
  const heures = amr.map((a) => (typeof a === "object" && a !== null ? (a as Record<string, unknown>).timestamp : null)).filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t > 0);
  return heures.length ? Math.max(...heures) * 1000 : null;
}

function signature(heure: string, lien: string, secret: string): string {
  return createHmac("sha256", secret).update(`${heure}.${lien}`).digest("base64url");
}

export function signerActivite(heure: number, lien: string, secret: string): string {
  const texte = String(heure);
  return `${texte}.${signature(texte, lien, secret)}`;
}

// Heure (texte) si le cookie est bien formé et signé pour cette session ; sinon undefined (absent, modifié, autre session, autre secret).
export function lireActiviteSignee(valeur: string | undefined, lien: string, secret: string): string | undefined {
  if (!valeur) return undefined;
  const point = valeur.indexOf(".");
  if (point < 0) return undefined;
  const heure = valeur.slice(0, point);
  if (!HEURE.test(heure)) return undefined;
  const recue = Buffer.from(valeur.slice(point + 1));
  const attendue = Buffer.from(signature(heure, lien, secret));
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return undefined;
  return heure;
}
