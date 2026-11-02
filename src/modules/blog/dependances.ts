import "server-only";
import { updateTag } from "next/cache";
import { exigerDroit } from "@/lib/auth/droits";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_ATTENTE, BUCKET_PUBLIC } from "@/lib/supabase/stockage";
import { lireArticleAdmin } from "./queries";
import type { DependancesBlog } from "./types";

// Les fonctions de la story 8.6 ne figurent pas encore dans src/lib/supabase/types.ts (types générés depuis le projet lié,
// que cette voie ne pousse pas) : même contournement local que pour les réglages publics (reglages.ts), les types générés
// ne sont jamais modifiés à la main.
type ReponseRpc = { data: unknown; error: { message: string; code?: string } | null };
type AppelRpc = (nom: string, parametres: Record<string, unknown>) => Promise<ReponseRpc>;

// Les vrais clients Supabase donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependances(): DependancesBlog {
  const admin = creerClientService();
  const rpc = admin.rpc as unknown as AppelRpc;
  return {
    exigerDroit,
      lireImagesArticle: async (id) => (await lireArticleAdmin(id))?.images ?? [],
    enregistrerArticle: async ({ auteur, id, article, images }) => {
      const { data, error } = await rpc("enregistrer_article", { p_auteur: auteur, p_id: id, p_article: article, p_images: images });
      // Seule la cause est renvoyée : le code KS_ du refus, sinon le code SQL. Jamais une donnée saisie.
      return {
        erreur: error ? (error.message.startsWith("KS_") ? error.message : (error.code || "inconnu")) : null,
        id: typeof data === "string" ? data : (id ?? null),
      };
    },
    changerPublication: async ({ auteur, id, publier }) => {
      const { error } = publier
        ? await rpc("publier_article", { p_auteur: auteur, p_id: id })
        : await rpc("depublier_article", { p_auteur: auteur, p_id: id });
      return { erreur: error ? (error.message.startsWith("KS_") ? error.message : (error.code || "inconnu")) : null };
    },
    signerEnvoiImage: async ({ objet }) => {
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
    supprimerObjet: async ({ bucket, objet }) => {
      const { error } = await admin.storage.from(bucket).remove([objet]);
      return { erreur: error ? error.message : null };
    },
    invaliderArticles: async () => {
      updateTag(ETIQUETTES.articles);
    },
  };
}
