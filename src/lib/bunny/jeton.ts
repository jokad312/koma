import { createHash } from "node:crypto";
import { z } from "zod";
import { BunnyNonConfigureError, normaliserHote } from "./config";

// Lecture de la bibliothèque Bunny PRIVÉE (vidéos complètes des Kits), story 3.7. Serveur seulement : la clé de jeton ne quitte jamais le serveur.
//
// Jeton de RÉPERTOIRE de la zone CDN de la bibliothèque privée, tel que la zone l'accepte (vérifié sur une vraie zone Bunny le 2026-11-04) :
//   - SHA-256 simple (PAS de HMAC, PAS de préfixe « HS256- ») de : clé de la Pull Zone + répertoire signé + expires + « token_path=<répertoire> »,
//     le répertoire étant donné BRUT (non encodé) dans les données signées ; jeton = Base64URL sans remplissage ;
//   - le répertoire signé est celui de la vidéo (« /<identifiant>/ »), donné aussi en `token_path` dans l'adresse (encodé) : un seul jeton
//     couvre playlist, segments et sous-titres ;
//   - style « chemin » : le jeton est le premier segment de l'adresse (« /bcdn_token=…&expires=…&token_path=…/<fichier> »), si bien que
//     les adresses relatives des segments lues dans la playlist le gardent sans rien changer au lecteur ;
//   - aucune IP signée.
// La variante HMAC-SHA256 « HS256- » de la documentation Advanced est refusée par cette zone (403 sur toute adresse), le SHA-256 simple est accepté.
// BUNNY_PRIVE_TOKEN_KEY = « Url token authentication Key » de la Pull Zone de la bibliothèque (Stream → bibliothèque → API → Pull zone → Security),
// et non la clé API ni la clé de l'onglet Security de la bibliothèque ; BUNNY_PRIVE_CDN_HOSTNAME = le nom d'hôte de cette zone.

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
  const signature = createHash("sha256").update(`${config.cleJeton}${repertoire}${expire}token_path=${repertoire}`).digest("base64url");
  const base = `https://${config.hoteCdn}/bcdn_token=${signature}&expires=${expire}&token_path=${tokenPath}${repertoire}`;
  return { playlist: `${base}playlist.m3u8`, sousTitres: (langue) => `${base}captions/${langue}.vtt` };
}
