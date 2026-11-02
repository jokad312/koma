import { z } from "zod";

// Lecture de la vidéo d'un Kit (story 3.7) : le serveur vérifie l'accès (la base), puis signe un jeton Bunny de courte durée.
// Sans accès, aucun jeton n'est créé (règle 1, AD-11). Position enregistrée toutes les 15 secondes et à la pause.

export const INTERVALLE_PROGRESSION_SECONDES = 15;

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);
const produitSchema = z.uuid();
const positionSchema = z.number().int().min(0).max(86400);

export type VideoALire = {
  produit_id: string;
  video_prive: string;
  duree_secondes: number;
  sous_titres: Array<"fr" | "en">;
  position_secondes: number;
};

export type DependancesVideo = {
  compteId: () => Promise<string | null>;
  // Null sans accès au Kit, ou Kit sans vidéo (la base vérifie l'accès).
  videoALire: (compteId: string, slug: string) => Promise<VideoALire | null>;
  // Adresses signées jusqu'à `expire` (secondes Unix) ; lève si la bibliothèque privée n'est pas réglée.
  adresses: (videoId: string, expire: number) => { playlist: string; sousTitres: (langue: "fr" | "en") => string };
  maintenantSecondes: () => number;
  dureeJetonSecondes: number;
  enregistrerProgression: (compteId: string, produitId: string, position: number) => Promise<boolean>;
};

export type LectureVideo = {
  playlist: string;
  sousTitres: Array<{ langue: "fr" | "en"; src: string }>;
  positionSecondes: number;
  dureeSecondes: number;
  expireLe: number;
};

export type ResultatLecture =
  | { statut: "ok"; lecture: LectureVideo }
  | { statut: "non_connecte" }
  | { statut: "refuse" }
  | { statut: "erreur" };

export async function preparerLecture(deps: DependancesVideo, slug: string): Promise<ResultatLecture> {
  try {
    const compte = await deps.compteId();
    if (!compte) return { statut: "non_connecte" };
    // Un nom invalide, un Kit inconnu, sans vidéo ou sans accès reçoivent le même refus : rien ne révèle ce qui existe.
    if (!slugSchema.safeParse(slug).success) return { statut: "refuse" };
    const video = await deps.videoALire(compte, slug);
    if (!video) return { statut: "refuse" };
    const expireLe = deps.maintenantSecondes() + deps.dureeJetonSecondes;
    const adresses = deps.adresses(video.video_prive, expireLe);
    return {
      statut: "ok",
      lecture: {
        playlist: adresses.playlist,
        sousTitres: video.sous_titres.map((langue) => ({ langue, src: adresses.sousTitres(langue) })),
        positionSecondes: Math.min(Math.max(video.position_secondes, 0), video.duree_secondes),
        dureeSecondes: video.duree_secondes,
        expireLe,
      },
    };
  } catch {
    console.error("[bibliotheque] préparation de la lecture impossible");
    return { statut: "erreur" };
  }
}

export type ResultatProgression = { ok: true } | { ok: false; erreur: "non_connecte" | "refuse" | "erreur" };

export async function enregistrerPosition(deps: DependancesVideo, produitId: string, position: number): Promise<ResultatProgression> {
  try {
    const compte = await deps.compteId();
    if (!compte) return { ok: false, erreur: "non_connecte" };
    if (!produitSchema.safeParse(produitId).success || !positionSchema.safeParse(position).success) return { ok: false, erreur: "refuse" };
    const ecrit = await deps.enregistrerProgression(compte, produitId, position);
    return ecrit ? { ok: true } : { ok: false, erreur: "refuse" };
  } catch {
    console.error("[bibliotheque] enregistrement de la progression impossible");
    return { ok: false, erreur: "erreur" };
  }
}

// Chapitre courant (index dans la liste) d'une position : celui dont le début est le plus avancé sans dépasser la position.
// Fonctionne quel que soit l'ordre de la liste (l'ordre d'affichage des chapitres est libre).
export function indexChapitre(debuts: readonly number[], position: number): number {
  let index = 0;
  let meilleur = -1;
  for (let i = 0; i < debuts.length; i++) {
    if (debuts[i] <= position && debuts[i] > meilleur) {
      meilleur = debuts[i];
      index = i;
    }
  }
  return index;
}

// Chapitres terminés : ceux que la position la plus avancée a dépassés (le suivant a commencé) ; le dernier compte quand la vidéo est terminée.
export function chapitresTermines(debuts: readonly number[], maxPosition: number, terminee: boolean): number {
  if (debuts.length === 0) return 0;
  if (terminee) return debuts.length;
  let n = 0;
  for (let i = 1; i < debuts.length; i++) if (debuts[i] <= maxPosition) n = i;
  return n;
}
