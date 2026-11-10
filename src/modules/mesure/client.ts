"use client";

import { type ActionMesure, estActionMesure } from "./actions";
import { appareilDepuisLargeur, domaineReferent, normaliserOrigine, pageMesuree } from "./chemins";
import type { LangueMesure } from "./types";

// Story 9.7 : envoi des événements depuis le navigateur. Aucun cookie, aucune IP, aucun identifiant de Compte.
// L'identifiant de session est aléatoire et rangé dans sessionStorage (repli en mémoire si le stockage est refusé) ;
// l'origine est la valeur d'un paramètre « origine » ou « utm_source », l'adresse elle-même ne quitte jamais la page.

const CLE_ETAT = "ks-mesure-etat";
const CLE_VUES = "ks-mesure-vues";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Etat = { session: string; origine: string | null; provenance: string | null };

let memoire: Etat | null = null;

function lireJson<T>(cle: string): T | null {
  try {
    const brut = window.sessionStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : null;
  } catch {
    return null;
  }
}

function ecrireJson(cle: string, valeur: unknown) {
  try {
    window.sessionStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Stockage refusé (navigation privée) : l'état reste en mémoire pour cet onglet.
  }
}

// Identifiant aléatoire, au format uuid : ni empreinte, ni valeur stable entre deux onglets ou deux visites.
function identifiant(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const octets = crypto.getRandomValues(new Uint8Array(16));
  octets[6] = (octets[6] & 0x0f) | 0x40;
  octets[8] = (octets[8] & 0x3f) | 0x80;
  const hex = Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function origineDeLAdresse(): string | null {
  const params = new URLSearchParams(window.location.search);
  return normaliserOrigine(params.get("origine")) ?? normaliserOrigine(params.get("utm_source"));
}

function etatMesure(): Etat {
  if (memoire) {
    const depuisAdresse = origineDeLAdresse();
    if (depuisAdresse && depuisAdresse !== memoire.origine) {
      memoire = { ...memoire, origine: depuisAdresse };
      ecrireJson(CLE_ETAT, memoire);
    }
    return memoire;
  }
  const enregistre = lireJson<Etat>(CLE_ETAT);
  if (enregistre && typeof enregistre.session === "string" && UUID.test(enregistre.session)) {
    memoire = enregistre;
    const depuisAdresse = origineDeLAdresse();
    if (depuisAdresse && depuisAdresse !== memoire.origine) {
      memoire = { ...memoire, origine: depuisAdresse };
      ecrireJson(CLE_ETAT, memoire);
    }
    return memoire;
  }
  memoire = {
    session: identifiant(),
    origine: origineDeLAdresse(),
    provenance: domaineReferent(document.referrer, window.location.hostname),
  };
  ecrireJson(CLE_ETAT, memoire);
  return memoire;
}

function langueCourante(): LangueMesure {
  return document.documentElement.lang === "en" ? "en" : "fr";
}

// Une seule vue de fiche par onglet : une navigation en arrière ne gonfle pas le compte de sessions.
// Repli en mémoire quand sessionStorage est refusé (navigation privée) : un retour arrière ne renvoie pas la vue.
const vuesMemoire = new Set<string>();
function dejaVu(page: string): boolean {
  const vues = lireJson<string[]>(CLE_VUES);
  if (vuesMemoire.has(page) || (Array.isArray(vues) && vues.includes(page))) return true;
  vuesMemoire.add(page);
  ecrireJson(CLE_VUES, [...(Array.isArray(vues) ? vues : []), page].slice(-50));
  return false;
}

// Durée du héros : seulement pour la première page du document. Après une navigation interne, performance.now() mesurerait
// le temps passé sur le site, pas le chargement du héros.
let navigationInterne = false;
export function signalerNavigationInterne() {
  navigationInterne = true;
}
export function estPremierePage(): boolean {
  return !navigationInterne;
}

// Prépare la session et l'origine : appelé une fois au montage du layout.
export function demarrerMesure() {
  if (typeof window === "undefined") return;
  etatMesure();
}

// Envoie un événement mesuré. La garde d'exclusion est ici aussi : une page exclue n'émet jamais de requête, et le serveur
// la refuserait de toute façon. Le résultat n'est jamais affiché : la mesure ne doit pas gêner le visiteur.
export function mesurer(action: ActionMesure, options: { dureeMs?: number } = {}) {
  if (typeof window === "undefined" || !estActionMesure(action)) return;
  const page = pageMesuree(action, window.location.pathname);
  if (!page) return;
  if (action === "vue_fiche" && dejaVu(page)) return;

  const etat = etatMesure();
  const corps: Record<string, unknown> = {
    action,
    langue: langueCourante(),
    appareil: appareilDepuisLargeur(window.innerWidth),
    session: etat.session,
    origine: etat.origine,
    provenance: etat.provenance,
  };
  if (action === "chargement_heros" && options.dureeMs !== undefined) {
    corps.duree = Math.min(60000, Math.max(0, Math.round(options.dureeMs)));
  }
  void fetch("/api/mesure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
    keepalive: true,
    cache: "no-store",
  }).catch(() => {
    // Mesure silencieuse : un envoi perdu ne change rien pour le visiteur.
  });
}
