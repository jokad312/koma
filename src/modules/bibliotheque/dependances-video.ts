import "server-only";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { adressesVideoPrivee, DUREE_JETON_VIDEO_SECONDES, lireConfigLecturePrivee } from "@/lib/bunny/jeton";
import { creerClientService } from "@/lib/supabase/service";
import type { DependancesVideo, VideoALire } from "./video";

export function dependancesVideo(): DependancesVideo {
  return {
    compteId: async () => (await lireSessionVerifiee())?.compteId ?? null,
    videoALire: async (compteId, slug) => {
      const { data, error } = await creerClientService().rpc("bibliotheque_video_a_lire", { p_compte: compteId, p_slug: slug });
      if (error) throw new Error("bibliotheque_video_a_lire");
      return (data as VideoALire | null) ?? null;
    },
    adresses: (videoId, expire) => adressesVideoPrivee(lireConfigLecturePrivee(), videoId, expire),
    maintenantSecondes: () => Math.floor(Date.now() / 1000),
    dureeJetonSecondes: DUREE_JETON_VIDEO_SECONDES,
    enregistrerProgression: async (compteId, produitId, position) => {
      const { data, error } = await creerClientService().rpc("bibliotheque_enregistrer_progression", {
        p_compte: compteId,
        p_produit: produitId,
        p_position: position,
      });
      if (error) throw new Error("bibliotheque_enregistrer_progression");
      return data === true;
    },
  };
}
