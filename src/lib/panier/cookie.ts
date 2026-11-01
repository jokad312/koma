import { createHmac, timingSafeEqual } from "node:crypto";

// Cookie du Panier d'un visiteur (AD-15) : « <identifiant du Panier>.<signature> », httpOnly, SameSite=Lax. L'identifiant est un UUID
// aléatoire ; la signature HMAC-SHA256 (PANIER_COOKIE_SECRET) empêche d'en fabriquer un. Le cookie ne contient aucun prix ni aucun article.
export const NOM_COOKIE_PANIER = "koma_panier";
// 30 jours : au-delà, un visiteur sans Compte retrouve un Panier vide.
export const DUREE_COOKIE_PANIER_S = 60 * 60 * 24 * 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONGUEUR_MIN_SECRET = 32;

// Lit le secret dans l'environnement ; jamais de valeur de repli (règle 4). Le message ne contient pas la valeur.
export function lireSecretPanier(source: Record<string, string | undefined> = process.env): string {
  const secret = source.PANIER_COOKIE_SECRET;
  if (!secret || secret.length < LONGUEUR_MIN_SECRET) {
    throw new Error(`Variable d'environnement absente ou trop courte : PANIER_COOKIE_SECRET (${LONGUEUR_MIN_SECRET} caractères au moins). Voir .env.example.`);
  }
  return secret;
}

function signature(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("base64url");
}

export function signerPanier(id: string, secret: string): string {
  return `${id}.${signature(id, secret)}`;
}

// Identifiant du Panier si le cookie est bien formé et correctement signé, sinon null (cookie absent, modifié ou d'un autre secret).
export function lirePanierSigne(valeur: string | null | undefined, secret: string): string | null {
  if (!valeur) return null;
  const point = valeur.indexOf(".");
  if (point < 0) return null;
  const id = valeur.slice(0, point);
  const recue = Buffer.from(valeur.slice(point + 1));
  if (!UUID.test(id)) return null;
  const attendue = Buffer.from(signature(id, secret));
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return null;
  return id;
}
