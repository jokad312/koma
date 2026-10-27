import "server-only";
import { updateTag } from "next/cache";
import { exigerDroit } from "@/lib/auth/droits";
import { lireConfigBunnyPublic } from "@/lib/bunny/config";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { lireEnvPublique } from "@/lib/env";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_ATTENTE, BUCKET_PUBLIC } from "@/lib/supabase/stockage";
import type { LecteurIntervalle } from "./heros-mp4";
import { lireHerosService } from "./heros-queries";
import type { DependancesHeros } from "./heros-types";

const DELAI_CDN_MS = 15_000;

// Lecture par intervalles d'un MP4 du CDN public. Le Referer est celui du site : si la bibliothèque limite les référents, le serveur lit
// le fichier comme le navigateur du visiteur. Null : fichier inaccessible (404, 403, réseau coupé) ou serveur sans prise en charge des intervalles.
async function ouvrirLecteurMp4(adresse: string): Promise<LecteurIntervalle | null> {
  const referer = lireEnvPublique().NEXT_PUBLIC_SITE_URL;
  const lireBrut = async (debut: number, fin: number) => {
    const r = await fetch(adresse, {
      headers: { Range: `bytes=${debut}-${fin - 1}`, Referer: referer },
      signal: AbortSignal.timeout(DELAI_CDN_MS),
    });
    return r;
  };
  try {
    const sonde = await lireBrut(0, 16);
    if (sonde.status !== 206) {
      await sonde.body?.cancel().catch(() => {});
      return null;
    }
    const total = /\/([0-9]+)$/.exec(sonde.headers.get("content-range") ?? "")?.[1];
    await sonde.body?.cancel().catch(() => {});
    if (!total) return null;
    return {
      taille: Number(total),
      lire: async (debut, fin) => {
        try {
          const r = await lireBrut(debut, fin);
          if (r.status !== 206) {
            await r.body?.cancel().catch(() => {});
            return null;
          }
          return new Uint8Array(await r.arrayBuffer());
        } catch {
          return null;
        }
      },
    };
  } catch {
    return null;
  }
}

export function dependancesHeros(): DependancesHeros {
  const admin = creerClientService();
  return {
    exigerDroit,
    configBunny: () => lireConfigBunnyPublic(),
    reseau: fetch,
    maintenant: () => Date.now(),
    lireHeros: lireHerosService,
    ecrireVedette: async ({ auteur, produitId }) => {
      const { error } = await admin.rpc("choisir_vedette_heros", { p_auteur: auteur as never, p_produit_id: (produitId ?? null) as never });
      return { erreur: error ? error.message : null };
    },
    ecrireVideo: async ({ auteur, videoId }) => {
      const { data, error } = await admin.rpc("enregistrer_video_heros", { p_auteur: auteur as never, p_video_id: (videoId ?? null) as never });
      return { erreur: error ? error.message : null, ancien: typeof data === "string" ? data : null };
    },
    validerVideo: async ({ auteur, videoId, fichier }) => {
      const { error } = await admin.rpc("valider_video_heros", { p_auteur: auteur as never, p_video_id: videoId, p_fichier: fichier });
      return { erreur: error ? error.message : null };
    },
    ecrireRepli: async ({ auteur, fichier, altFr, altEn }) => {
      const { data, error } = await admin.rpc("enregistrer_repli_heros", {
        p_auteur: auteur as never,
        p_fichier: (fichier ?? null) as never,
        p_alt_fr: altFr,
        p_alt_en: altEn,
      });
      return { erreur: error ? error.message : null, ancien: typeof data === "string" ? data : null };
    },
    signerEnvoiPhoto: async ({ objet }) => {
      const { data, error } = await admin.storage.from(BUCKET_ATTENTE).createSignedUploadUrl(objet);
      return { erreur: error ? error.message : null, jeton: data?.token ?? null };
    },
    lireObjetAttente: async (objet) => {
      const { data, error } = await admin.storage.from(BUCKET_ATTENTE).download(objet);
      if (error || !data) return { erreur: error ? error.message : "objet absent", octets: null };
      return { erreur: null, octets: new Uint8Array(await data.arrayBuffer()) };
    },
    ecrireObjetPublic: async ({ objet, octets, contentType }) => {
      const { error } = await admin.storage.from(BUCKET_PUBLIC).upload(objet, octets, { contentType, upsert: false, cacheControl: "31536000" });
      return { erreur: error ? error.message : null };
    },
    supprimerObjets: async ({ bucket, objets }) => {
      const { error } = await admin.storage.from(bucket).remove(objets);
      return { erreur: error ? error.message : null };
    },
    ouvrirLecteurMp4,
    invalider: async () => {
      updateTag(ETIQUETTES.reglages);
      updateTag(ETIQUETTES.catalogue);
    },
  };
}
