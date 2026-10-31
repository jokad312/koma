import type { LangueSousTitres } from "./types";

// Adresses publiques de l'extrait d'un Kit sur le CDN de la bibliothèque Bunny PUBLIQUE (jamais la bibliothèque privée). Fonctions pures.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdressesExtrait = { playlist: string; vignette: string; sousTitres: (langue: LangueSousTitres) => string };

// null : hôte du CDN non réglé ou identifiant mal formé (aucun lecteur ni VideoObject n'est alors rendu).
export function adressesExtrait(hoteCdn: string | null, extraitId: string): AdressesExtrait | null {
  if (!hoteCdn || !UUID.test(extraitId)) return null;
  const base = `https://${hoteCdn}/${extraitId.toLowerCase()}`;
  return {
    playlist: `${base}/playlist.m3u8`,
    vignette: `${base}/thumbnail.jpg`,
    sousTitres: (langue) => `${base}/captions/${langue}.vtt`,
  };
}
