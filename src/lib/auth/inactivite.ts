import { createClient } from "@supabase/supabase-js";
import { ADRESSES } from "@/i18n/adresses";
import { lireEnvPublique } from "@/lib/env";

// Déconnexion après inactivité (story 9.14). Fonctions pures et lecture du réglage, utilisées par le proxy.
export { COOKIE_ACTIVITE, COOKIE_SESSION_EXPIREE } from "./inactivite-cookies";
export const CLE_REGLAGE_INACTIVITE = "session_inactivite_heures";
export const INACTIVITE_DEFAUT_HEURES = 4;
export const INACTIVITE_MIN_HEURES = 1;
export const INACTIVITE_MAX_HEURES = 24;
// Le cookie d'activité n'est réécrit qu'une fois par minute au plus.
export const PAS_RAFRAICHISSEMENT_MS = 60_000;
const DUREE_CACHE_REGLAGE_MS = 60_000;
const HEURE_MS = 3_600_000;

export type DecisionActivite = "rien" | "poser" | "expire" | "supprimer";

// Décision pour une requête : valeur du cookie d'activité, heure courante, session présente, délai en millisecondes.
// connexionLe : heure de connexion de la session (jeton) ; quand le cookie manque ou est refusé (supprimé, fabriqué, d'une autre session),
// une session connectée depuis plus longtemps que le délai expire au lieu de repartir de zéro (cookie signé, décision du 2026-11-13).
export function evaluerActivite(args: { valeur: string | undefined; maintenant: number; aSession: boolean; delaiMs: number; connexionLe?: number | null }): DecisionActivite {
  const { valeur, maintenant, aSession, delaiMs, connexionLe = null } = args;
  if (!aSession) return valeur === undefined ? "rien" : "supprimer";
  const sansCookieValable = () => (connexionLe !== null && maintenant - connexionLe > delaiMs + PAS_RAFRAICHISSEMENT_MS ? "expire" : "poser");
  if (valeur === undefined || !/^[0-9]{10,14}$/.test(valeur)) return sansCookieValable();
  const derniere = Number(valeur);
  // Heure dans le futur (horloge ou cookie bricolé) : traitée comme absente.
  if (derniere > maintenant + PAS_RAFRAICHISSEMENT_MS) return sansCookieValable();
  // Le cookie n'est réécrit qu'une fois par minute : la dernière activité réelle peut être jusqu'à une minute plus récente que lui.
  // La marge évite d'expirer trop tôt (au pire une minute trop tard).
  if (maintenant - derniere > delaiMs + PAS_RAFRAICHISSEMENT_MS) return "expire";
  return maintenant - derniere >= PAS_RAFRAICHISSEMENT_MS ? "poser" : "rien";
}

// Pages où la personne expirée est menée à la connexion (décision de Jonathan du 2026-11-13) : Mon compte, commande et paiement
// (/commande et /commande/[numero]), admin et scan. Chemin sans préfixe de langue. Toute autre page garde la personne en visiteur,
// avec un bandeau discret.
// Les adresses propres à chaque langue viennent de ADRESSES (ex. /commande en français, /checkout en anglais).
const DOSSIERS_PROTEGES = ["/compte", "/commande", "/admin", "/scan"];
const PREFIXES_PROTEGES = [
  ...new Set(DOSSIERS_PROTEGES.flatMap((d) => [d, ...ADRESSES.filter((a) => a.interne === d).flatMap((a) => [a.fr, a.en])])),
];

export function estPageProtegee(cheminSansLangue: string): boolean {
  return PREFIXES_PROTEGES.some((p) => cheminSansLangue === p || cheminSansLangue.startsWith(`${p}/`));
}

export function heuresValides(brut: string | null | undefined): number | null {
  if (typeof brut !== "string" || !/^[0-9]{1,2}$/.test(brut.trim())) return null;
  const n = Number(brut.trim());
  return n >= INACTIVITE_MIN_HEURES && n <= INACTIVITE_MAX_HEURES ? n : null;
}

let cache: { delaiMs: number; luLe: number } | null = null;

// Délai d'inactivité réglé dans l'admin, en millisecondes. Cache court en mémoire (une lecture par minute au plus) ;
// réglage absent, invalide ou base muette : dernière valeur connue, sinon 4 heures (décision du 2026-11-12).
export async function lireDelaiInactiviteMs(maintenant: number = Date.now(), delaiLectureMs = 1500): Promise<number> {
  if (cache && maintenant - cache.luLe < DUREE_CACHE_REGLAGE_MS) return cache.delaiMs;
  const repli = cache?.delaiMs ?? INACTIVITE_DEFAUT_HEURES * HEURE_MS;
  try {
    const env = lireEnvPublique();
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (entree, init) => fetch(entree, { ...init, signal: AbortSignal.timeout(delaiLectureMs) }) },
    });
    const { data, error } = await client.from("reglage").select("valeur").eq("cle", CLE_REGLAGE_INACTIVITE).maybeSingle();
    if (error) throw new Error("lecture");
    const heures = heuresValides(data?.valeur) ?? INACTIVITE_DEFAUT_HEURES;
    cache = { delaiMs: heures * HEURE_MS, luLe: maintenant };
    return cache.delaiMs;
  } catch {
    console.error("[proxy] réglage d'inactivité illisible : dernière valeur connue");
    cache = { delaiMs: repli, luLe: maintenant };
    return repli;
  }
}

// Pour les tests : vide le cache en mémoire.
export function viderCacheInactivite() {
  cache = null;
}
