import { createHmac } from "node:crypto";
import { z } from "zod";
import { BunnyNonConfigureError, normaliserHote } from "./config";

// Lecture de la bibliothèque Bunny PRIVÉE (vidéos complètes des Kits), story 3.7. Serveur seulement : la clé de jeton ne quitte jamais le serveur.
//
// Jeton « Advanced » du CDN Bunny (documentation officielle, bunny.net/docs/cdn/security/token-authentication/advanced) :
//   - HMAC-SHA256 dont la clé est la clé de sécurité de la zone ; message = chemin signé + expires + données signées ;
//   - jeton de RÉPERTOIRE : le chemin signé est le répertoire de la vidéo (« /<identifiant>/ »), donné aussi en `token_path`
//     (compris dans les données signées) : un seul jeton couvre playlist, segments et sous-titres ;
//   - style « chemin » : le jeton est le premier segment de l'adresse (« /bcdn_token=…&expires=…&token_path=…/<fichier> »), si bien que
//     les adresses relatives des segments lues dans la playlist le gardent sans rien changer au lecteur ;
//   - jeton = « HS256- » + Base64URL(HMAC), sans IP signée.
// Réglage à faire une fois par Jonathan : activer « Token Authentication » en mode Advanced sur la zone CDN de la bibliothèque privée
// (BUNNY_PRIVE_TOKEN_KEY = sa clé de sécurité, BUNNY_PRIVE_CDN_HOSTNAME = son nom d'hôte). Non vérifié contre une vraie zone Bunny : le test
// manuel de la story (adresse copiée sans jeton valide refusée, lecture avec jeton valide) en fait foi.

// Durée d'un jeton de lecture (décision de la story 3.7) : 4 heures. Assez longue pour un tutoriel regardé avec des pauses sans que les
// segments se mettent à renvoyer 403 en cours de lecture ; assez courte pour qu'une adresse copiée devienne inutile le jour même.
export const DUREE_JETON_VIDEO_SECONDES = 4 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ConfigLecturePrivee = { hoteCdn: string; cleJeton: string };

const schema = z.object({ BUNNY_PRIVE_TOKEN_KEY: z.string().min(8) });

export function lireConfigLecturePrivee(source: Record<string, string | undefined> = process.env): ConfigLecturePrivee {
  const resultat = schema.safeParse(source);
  const hote = normaliserHote(source.BUNNY_PRIVE_CDN_HOSTNAME ?? "");
  const noms = resultat.success ? [] : ["BUNNY_PRIVE_TOKEN_KEY"];
  if (!hote) noms.push("BUNNY_PRIVE_CDN_HOSTNAME");
  if (!resultat.success || !hote) throw new BunnyNonConfigureError(noms);
  return { hoteCdn: hote, cleJeton: resultat.data.BUNNY_PRIVE_TOKEN_KEY };
}

export type AdressesVideoPrivee = { playlist: string; sousTitres: (langue: "fr" | "en") => string };

// Adresses signées d'une vidéo privée, valables jusqu'à `expire` (secondes Unix). Fonction pure : l'heure est donnée par l'appelant.
export function adressesVideoPrivee(config: ConfigLecturePrivee, videoId: string, expire: number): AdressesVideoPrivee {
  if (!UUID.test(videoId)) throw new Error("Identifiant de vidéo invalide.");
  if (!Number.isInteger(expire) || expire <= 0) throw new Error("Expiration invalide.");
  const repertoire = `/${videoId.toLowerCase()}/`;
  const tokenPath = encodeURIComponent(repertoire);
  const donnees = `token_path=${tokenPath}`;
  const signature = createHmac("sha256", config.cleJeton).update(`${repertoire}${expire}${donnees}`).digest("base64url");
  const base = `https://${config.hoteCdn}/bcdn_token=HS256-${signature}&expires=${expire}&token_path=${tokenPath}${repertoire}`;
  return { playlist: `${base}playlist.m3u8`, sousTitres: (langue) => `${base}captions/${langue}.vtt` };
}
