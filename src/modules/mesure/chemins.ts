import { ACTIONS_COMPTE, ACTIONS_PRIVEES, type ActionMesure } from "./actions";
import type { Appareil } from "./types";

// Story 9.7 : règles pures du chemin, de l'origine et du référent. Elles servent au navigateur (garde avant envoi) et au
// serveur (garde avant écriture) ; la base revalide tout. Aucune chaîne de requête ne sort jamais de ces fonctions.

// Segments de premier niveau jamais mesurés (décision de Jonathan du 2026-11-10). « /administration » n'est pas « /admin » :
// la comparaison porte sur le segment entier.
// « panier » et « paiement » : jamais de mesure sur le parcours d'achat ; « api » et « auth » ne sont pas des pages.
export const PREFIXES_EXCLUS = ["admin", "compte", "connexion", "commande", "checkout", "desinscription", "panier", "paiement", "api", "auth"] as const;

const EXCLUS = new Set<string>(PREFIXES_EXCLUS);
const DEPUIS_COMPTE = new Set<string>(ACTIONS_COMPTE);
const PRIVEES = new Set<string>(ACTIONS_PRIVEES);
const LANGUE_PREFIXE = /^\/(fr|en)(\/|$)/;

// Garde un chemin seul, décodé et en minuscules : pas de requête ni d'ancre, et seulement les caractères des adresses du site
// (lettres latines minuscules, chiffres, « / », « . », « _ », « - »), 200 au plus. « /fr/%63ompte » devient « /fr/compte » et
// tombe donc sous l'exclusion ; un encodage illisible, un « %2F » ou un texte libre sont refusés (même règle que la base).
const CHEMIN_PERMIS = /^\/[a-z0-9/._-]*$/;
export function normaliserChemin(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const brutCoupe = brut.split(/[?#]/, 1)[0];
  if (!brutCoupe || /%2f/i.test(brutCoupe)) return null;
  let coupe: string;
  try {
    coupe = decodeURIComponent(brutCoupe).toLowerCase();
  } catch {
    return null;
  }
  if (coupe.length > 200 || coupe.startsWith("//") || !CHEMIN_PERMIS.test(coupe)) return null;
  return coupe;
}

// Retire le préfixe de langue : /fr/cosplays et /en/cosplays donnent /cosplays (la langue est une colonne à part).
export function sansLangue(chemin: string): string {
  if (!LANGUE_PREFIXE.test(chemin)) return chemin;
  const morceaux = chemin.split("/");
  morceaux.splice(1, 1);
  const reste = morceaux.join("/");
  return reste === "" ? "/" : reste;
}

// Page à enregistrer pour une action, ou null si l'envoi doit être refusé.
// - /compte : seules les actions de la liste fermée sont acceptées, et la page vaut toujours « /compte » (jamais le sous-chemin).
// - les actions privées n'existent que sous /compte.
// - tous les autres préfixes exclus refusent l'action, quelle qu'elle soit.
export function pageMesuree(action: ActionMesure, chemin: string | null | undefined): string | null {
  const normalise = normaliserChemin(chemin);
  if (!normalise) return null;
  const page = sansLangue(normalise);
  const premier = (page.split("/")[1] ?? "").toLowerCase();
  if (premier === "compte") return DEPUIS_COMPTE.has(action) ? "/compte" : null;
  if (EXCLUS.has(premier)) return null;
  if (PRIVEES.has(action)) return null;
  return page;
}

// Chemin d'une page interne, tiré du Referer côté serveur. Un Referer absent, illisible ou d'une autre origine rend null :
// dans ce cas la route n'écrit rien (décision de Jonathan du 2026-11-10 : on ne fait pas confiance au chemin du client).
export function cheminDepuisReferer(referer: string | null | undefined, hote: string | null | undefined): string | null {
  if (!referer || !hote) return null;
  let adresse: URL;
  try {
    adresse = new URL(referer);
  } catch {
    return null;
  }
  if (adresse.protocol !== "http:" && adresse.protocol !== "https:") return null;
  if (adresse.host.toLowerCase() !== hote.trim().toLowerCase()) return null;
  return normaliserChemin(adresse.pathname);
}

// Origine normalisée : valeur d'un paramètre « origine » ou « utm_source », jamais l'adresse complète.
export function normaliserOrigine(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const valeur = brut.trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(valeur) ? valeur : null;
}

// Référent réduit au domaine : ni chemin, ni requête, ni port. Le domaine du site lui-même n'est pas une provenance.
export function domaineReferent(brut: string | null | undefined, hoteSite?: string | null): string | null {
  if (!brut) return null;
  let adresse: URL;
  try {
    adresse = new URL(brut);
  } catch {
    return null;
  }
  if (adresse.protocol !== "http:" && adresse.protocol !== "https:") return null;
  const domaine = adresse.hostname.toLowerCase().replace(/^www\./, "");
  if (!domaine || domaine.length > 100 || !/^[a-z0-9.-]+$/.test(domaine)) return null;
  const propre = (hoteSite ?? "").toLowerCase().split(":")[0].replace(/^www\./, "");
  if (propre && domaine === propre) return null;
  return domaine;
}

// Type d'appareil, déduit de la largeur seulement (aucune empreinte d'appareil, aucun User-Agent).
export function appareilDepuisLargeur(largeur: number | null | undefined): Appareil {
  if (typeof largeur !== "number" || !Number.isFinite(largeur) || largeur <= 0) return "inconnu";
  if (largeur < 768) return "mobile";
  if (largeur < 1024) return "tablette";
  return "ordinateur";
}
