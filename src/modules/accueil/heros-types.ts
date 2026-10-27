import type { AuteurCompte } from "@/lib/auth/auteur";
import type { Droit } from "@/lib/auth/matrice-droits";
import type { AutorisationEnvoiBunny, Reseau } from "@/lib/bunny/api";
import type { ConfigBunnyPublic } from "@/lib/bunny/config";
import type { LecteurIntervalle } from "./heros-mp4";

// Vidéo du héros : MP4 court. 200 Mo au plus avant l'encodage (le fichier rendu par Bunny est bien plus léger).
export const VIDEO_HEROS_TAILLE_MAX = 200 * 1024 * 1024;
// Types de vidéo acceptés à l'envoi (Bunny les encode) ; le contenu réel est vérifié sur le MP4 rendu.
export const TYPES_VIDEO_HEROS = ["video/mp4", "video/quicktime", "video/webm"] as const;

export type CodeErreurHeros =
  | "non_autorise"
  | "generique"
  | "bunny_non_configure"
  | "bunny_indisponible"
  | "vedette_invalide"
  | "type_invalide"
  | "format_invalide"
  | "fichier_trop_lourd"
  | "alt_invalide"
  | "photo_introuvable"
  | "video_introuvable"
  | "encodage_echec"
  | "mp4_indisponible"
  | "video_illisible"
  | "video_avec_audio";

export type ResultatHeros<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreurHeros };

// État lu en base pour l'admin et le serveur.
export type EtatHeros = {
  produitId: string | null;
  videoId: string | null;
  // Fichier MP4 validé par le serveur ; nul tant que la vidéo n'a pas été vérifiée.
  videoFichier: string | null;
  repliFichier: string | null;
  repliAltFr: string | null;
  repliAltEn: string | null;
};

export type EtatVideo = { etat: "en_cours"; progression: number } | { etat: "prete" };

export type DependancesHeros = {
  exigerDroit: (droit: Droit) => Promise<{ auteur: AuteurCompte }>;
  // Lève BunnyNonConfigureError si une variable manque.
  configBunny: () => ConfigBunnyPublic;
  reseau: Reseau;
  maintenant: () => number;
  lireHeros: () => Promise<EtatHeros>;
  ecrireVedette: (e: { auteur: AuteurCompte; produitId: string | null }) => Promise<{ erreur: string | null }>;
  // Renvoie l'ancienne vidéo (à effacer chez Bunny) ou null.
  ecrireVideo: (e: { auteur: AuteurCompte; videoId: string | null }) => Promise<{ erreur: string | null; ancien: string | null }>;
  validerVideo: (e: { auteur: AuteurCompte; videoId: string; fichier: string }) => Promise<{ erreur: string | null }>;
  // Renvoie l'ancien objet de repli (à effacer du bucket) ou null. fichier nul : seuls les textes changent.
  ecrireRepli: (e: { auteur: AuteurCompte; fichier: string | null; altFr: string; altEn: string }) => Promise<{ erreur: string | null; ancien: string | null }>;
  signerEnvoiPhoto: (e: { objet: string }) => Promise<{ erreur: string | null; jeton: string | null }>;
  lireObjetAttente: (objet: string) => Promise<{ erreur: string | null; octets: Uint8Array | null }>;
  ecrireObjetPublic: (e: { objet: string; octets: Uint8Array; contentType: string }) => Promise<{ erreur: string | null }>;
  supprimerObjets: (e: { bucket: "galerie-attente" | "produits-public"; objets: string[] }) => Promise<{ erreur: string | null }>;
  // Ouvre en lecture par intervalles le MP4 public (adresse complète) ; null : fichier inaccessible.
  ouvrirLecteurMp4: (adresse: string) => Promise<LecteurIntervalle | null>;
  invalider: () => Promise<void>;
};

export type EnvoiVideoAutorise = AutorisationEnvoiBunny & { titre: string };
