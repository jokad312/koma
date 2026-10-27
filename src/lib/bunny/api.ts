import { createHash } from "node:crypto";
import type { ConfigBunnyPublic } from "./config";

// API Bunny Stream (bibliothèque PUBLIQUE). Serveur seulement : la clé ne quitte jamais ce module, et aucune erreur n'en porte la valeur.
// Le réseau est injecté (fetch) pour que les tests n'appellent jamais Bunny, sauf le test réseau nommé TEST_.
const API = "https://video.bunnycdn.com";
export const ADRESSE_TUS_BUNNY = `${API}/tusupload`;
// Toute vidéo créée pour le héros porte ce préfixe de titre : le serveur n'efface jamais une vidéo qui ne le porte pas.
export const PREFIXE_TITRE_HEROS = "koma-heros-";
// Durée de validité de l'autorisation d'envoi (secondes) : assez pour un envoi long avec reprises.
export const VALIDITE_ENVOI_SECONDES = 6 * 60 * 60;
const DELAI_MS = 15_000;

export type EtatBunny = "cree" | "envoye" | "encodage" | "termine" | "echec";

export type VideoBunny = {
  id: string;
  titre: string;
  etat: EtatBunny;
  progression: number;
  resolutions: string[];
};

export type Reseau = typeof fetch;

export class BunnyErreur extends Error {
  readonly code = "KS_BUNNY_ERREUR";
  constructor(
    contexte: string,
    readonly statut: number | null,
  ) {
    super(`KS_BUNNY_ERREUR : ${contexte}${statut ? ` (statut ${statut})` : ""}`);
  }
}

function entetes(config: ConfigBunnyPublic): Record<string, string> {
  return { AccessKey: config.cle, accept: "application/json" };
}

// Statuts documentés par Bunny : 0 créée, 1 envoyée, 2 en traitement, 3 en encodage, 4 terminée, 5 erreur, 6 échec de l'envoi.
function etatDe(statut: unknown): EtatBunny {
  switch (statut) {
    case 0:
      return "cree";
    case 1:
      return "envoye";
    case 2:
    case 3:
      return "encodage";
    case 4:
      return "termine";
    default:
      return "echec";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const estIdVideo = (v: string) => UUID.test(v);

function lireVideo(brut: unknown): VideoBunny {
  const o = brut as { guid?: unknown; title?: unknown; status?: unknown; encodeProgress?: unknown; availableResolutions?: unknown } | null;
  if (!o || typeof o.guid !== "string" || !UUID.test(o.guid)) throw new BunnyErreur("réponse inattendue", null);
  return {
    id: o.guid.toLowerCase(),
    titre: typeof o.title === "string" ? o.title : "",
    etat: etatDe(o.status),
    progression: typeof o.encodeProgress === "number" ? o.encodeProgress : 0,
    resolutions: typeof o.availableResolutions === "string" ? o.availableResolutions.split(",").map((r) => r.trim()).filter(Boolean) : [],
  };
}

async function appeler(reseau: Reseau, contexte: string, url: string, init: RequestInit): Promise<Response> {
  try {
    return await reseau(url, { ...init, signal: AbortSignal.timeout(DELAI_MS) });
  } catch {
    throw new BunnyErreur(`${contexte} : réseau ou délai`, null);
  }
}

export async function creerVideoBunny(config: ConfigBunnyPublic, titre: string, reseau: Reseau = fetch): Promise<VideoBunny> {
  const r = await appeler(reseau, "création", `${API}/library/${config.bibliothequeId}/videos`, {
    method: "POST",
    headers: { ...entetes(config), "content-type": "application/json" },
    body: JSON.stringify({ title: titre }),
  });
  if (!r.ok) throw new BunnyErreur("création", r.status);
  return lireVideo(await r.json());
}

// null : la vidéo n'existe pas (404).
export async function lireVideoBunny(config: ConfigBunnyPublic, id: string, reseau: Reseau = fetch): Promise<VideoBunny | null> {
  if (!UUID.test(id)) return null;
  const r = await appeler(reseau, "lecture", `${API}/library/${config.bibliothequeId}/videos/${id}`, { headers: entetes(config) });
  if (r.status === 404) return null;
  if (!r.ok) throw new BunnyErreur("lecture", r.status);
  return lireVideo(await r.json());
}

// Efface une vidéo de la bibliothèque. Un 404 vaut « déjà effacée ».
export async function supprimerVideoBunny(config: ConfigBunnyPublic, id: string, reseau: Reseau = fetch): Promise<void> {
  if (!UUID.test(id)) return;
  const r = await appeler(reseau, "suppression", `${API}/library/${config.bibliothequeId}/videos/${id}`, { method: "DELETE", headers: entetes(config) });
  if (!r.ok && r.status !== 404) throw new BunnyErreur("suppression", r.status);
}

export type AutorisationEnvoiBunny = {
  adresse: string;
  signature: string;
  expiration: number;
  videoId: string;
  bibliothequeId: string;
};

// Autorisation d'envoi TUS : SHA-256 de (bibliothèque + clé + expiration + vidéo), documenté par Bunny. La clé sert au calcul, jamais transmise.
export function signerEnvoiBunny(config: ConfigBunnyPublic, videoId: string, maintenantMs: number): AutorisationEnvoiBunny {
  const expiration = Math.floor(maintenantMs / 1000) + VALIDITE_ENVOI_SECONDES;
  const signature = createHash("sha256").update(`${config.bibliothequeId}${config.cle}${expiration}${videoId}`).digest("hex");
  return { adresse: ADRESSE_TUS_BUNNY, signature, expiration, videoId, bibliothequeId: config.bibliothequeId };
}

// Choix du fichier MP4 du héros parmi les résolutions rendues : 720p si elle existe, sinon la plus grande en dessous, sinon la plus petite.
// Null : aucune résolution lisible.
export function choisirFichierMp4(resolutions: readonly string[]): string | null {
  const hauteurs = resolutions
    .map((r) => /^([0-9]{3,4})p$/.exec(r.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  if (hauteurs.length === 0) return null;
  const choisie = [...hauteurs].reverse().find((h) => h <= 720) ?? hauteurs[0];
  return `play_${choisie}p.mp4`;
}
