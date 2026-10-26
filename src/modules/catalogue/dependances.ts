import "server-only";
import { updateTag } from "next/cache";
import { exigerDroit } from "@/lib/auth/droits";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_ATTENTE, BUCKET_PUBLIC } from "@/lib/supabase/stockage";
import { lireProduitPourPublication, premierSlugLibre } from "./queries";
import type { DependancesCatalogue } from "./types";

// Les vrais clients donnés au service (en test, des faux nommés TEST_ les remplacent).
// L'étiquette « catalogue » est vidée par updateTag à la publication et à la dépublication (le catalogue public arrive en 2.4 et 2.5).
export function dependances(): DependancesCatalogue {
  const admin = creerClientService();
  return {
    exigerDroit,
    ecrireUnivers: async ({ auteur, nomFr, nomEn }) => {
      const { data, error } = await admin.rpc("creer_univers", { p_auteur: auteur as never, p_nom_fr: nomFr, p_nom_en: nomEn });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    ecrireProduit: async ({ auteur, id, produit, variantes }) => {
      const { data, error } = await admin.rpc("enregistrer_produit", {
        p_auteur: auteur as never,
        p_id: (id ?? null) as never,
        p_produit: produit as never,
        p_variantes: variantes as never,
      });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    premierSlugLibre,
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
    ecrirePhoto: async ({ auteur, produitId, fichier, altFr, altEn }) => {
      const { data, error } = await admin.rpc("ajouter_photo_produit", {
        p_auteur: auteur as never,
        p_produit_id: produitId,
        p_fichier: fichier,
        p_alt_fr: altFr,
        p_alt_en: altEn,
      });
      return { erreur: error ? error.message : null, id: typeof data === "string" ? data : null };
    },
    deplacerPhoto: async ({ auteur, photoId, sens }) => {
      const { error } = await admin.rpc("deplacer_photo_produit", { p_auteur: auteur as never, p_photo_id: photoId, p_sens: sens });
      return { erreur: error ? error.message : null };
    },
    supprimerPhoto: async ({ auteur, photoId }) => {
      const { data, error } = await admin.rpc("supprimer_photo_produit", { p_auteur: auteur as never, p_photo_id: photoId });
      return { erreur: error ? error.message : null, fichier: typeof data === "string" ? data : null };
    },
    modifierAltPhoto: async ({ auteur, photoId, altFr, altEn }) => {
      const { error } = await admin.rpc("modifier_alt_photo", { p_auteur: auteur as never, p_photo_id: photoId, p_alt_fr: altFr, p_alt_en: altEn });
      return { erreur: error ? error.message : null };
    },
    changerPublication: async ({ auteur, id, publier }) => {
      const { error } = publier
        ? await admin.rpc("publier_produit", { p_auteur: auteur as never, p_id: id })
        : await admin.rpc("depublier_produit", { p_auteur: auteur as never, p_id: id });
      return { erreur: error ? error.message : null };
    },
    ecrireTranches: async ({ auteur, tranches }) => {
      const { error } = await admin.rpc("enregistrer_tranches_prix", { p_auteur: auteur as never, p_tranches: tranches as never });
      return { erreur: error ? error.message : null };
    },
    invaliderReglages: async () => {
      updateTag(ETIQUETTES.reglages);
    },
    invaliderCatalogue: async () => {
      updateTag(ETIQUETTES.catalogue);
    },
    lireProduitComplet: lireProduitPourPublication,
  };
}
