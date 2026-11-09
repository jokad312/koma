import "server-only";
import { CompteRefuseError, exigerCompteComplet } from "@/lib/auth/compte";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_ATTENTE } from "@/lib/supabase/stockage";
import { LIMITE_ENVOIS_PHOTO_PAR_HEURE, VERSION_ACCORD_PUBLICATION } from "./types";
import type { DependancesCommunaute, StatutPhoto } from "./types";

// Durée de l'aperçu signé d'une photo en attente (bucket privé) : 10 minutes.
const DUREE_APERCU_SECONDES = 600;
const STATUTS: readonly StatutPhoto[] = ["en_attente", "publiee", "refusee", "retiree"];

// Les vrais accès donnés au service (en test, des faux nommés TEST_ les remplacent). Tout passe par le client service, côté serveur.
export function dependancesCommunaute(): DependancesCommunaute {
  const admin = creerClientService();
  return {
    compte: async () => {
      try {
        return await exigerCompteComplet();
      } catch (e) {
        if (e instanceof CompteRefuseError && e.message !== "KS_VERIFICATION_IMPOSSIBLE") return null;
        throw e;
      }
    },
    estMineur: async (compteId) => {
      const { data, error } = await admin.rpc("est_mineur", { p_compte: compteId });
      if (error) throw new Error("est_mineur");
      return data === true;
    },
    consommerEssai: async (cle) => {
      const { data, error } = await admin.rpc("consommer_essai", { p_cle: cle, p_fenetre_secondes: 3600, p_maximum: LIMITE_ENVOIS_PHOTO_PAR_HEURE });
      return error ? { erreur: error.message } : { autorise: data === true };
    },
    signerEnvoi: async (objet) => {
      const { data, error } = await admin.storage.from(BUCKET_ATTENTE).createSignedUploadUrl(objet);
      return error || !data?.token ? { erreur: error?.message ?? "jeton absent" } : { jeton: data.token };
    },
    lireObjet: async (objet) => {
      const { data, error } = await admin.storage.from(BUCKET_ATTENTE).download(objet);
      if (error || !data) return { erreur: error?.message ?? "objet absent" };
      return { octets: new Uint8Array(await data.arrayBuffer()) };
    },
    ecrireObjet: async ({ objet, octets, contentType }) => {
      const { error } = await admin.storage.from(BUCKET_ATTENTE).upload(objet, octets, { contentType, upsert: false });
      return { erreur: error ? error.message : null };
    },
    supprimerObjet: async (objet) => {
      const { error } = await admin.storage.from(BUCKET_ATTENTE).remove([objet]);
      return { erreur: error ? error.message : null };
    },
    deposer: async ({ auteur, objet, nom, ville }) => {
      const { data, error } = await admin.rpc("deposer_photo_galerie", {
        p_auteur: auteur as never,
        p_objet: objet,
        p_nom: nom as never,
        p_ville: ville as never,
        p_version_accord: VERSION_ACCORD_PUBLICATION,
      });
      if (error || typeof data !== "string") return { erreur: error?.message ?? "deposer_photo_galerie" };
      return { id: data };
    },
    lister: async (compteId) => {
      const { data, error } = await admin.rpc("lister_mes_photos", { p_compte: compteId });
      if (error || !Array.isArray(data)) return { erreur: error?.message ?? "lister_mes_photos" };
      const objets: Record<string, string> = {};
      const photos = (data as Record<string, unknown>[]).flatMap((p) => {
        const statut = STATUTS.find((s) => s === p.statut);
        if (typeof p.id !== "string" || !statut || typeof p.cree_le !== "string") return [];
        if (typeof p.objet === "string") objets[p.id] = p.objet;
        return [
          {
            id: p.id,
            statut,
            nomAffiche: typeof p.nom_affiche === "string" ? p.nom_affiche : null,
            ville: typeof p.ville === "string" ? p.ville : null,
            retraitDemande: typeof p.retrait_demande_le === "string",
            creeLe: p.cree_le,
          },
        ];
      });
      return { photos, objets };
    },
    apercus: async (objets) => {
      const { data, error } = await admin.storage.from(BUCKET_ATTENTE).createSignedUrls(objets, DUREE_APERCU_SECONDES);
      if (error || !data) return {};
      return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
    },
    retirer: async (auteur, photoId) => {
      const { data, error } = await admin.rpc("retirer_photo", { p_auteur: auteur as never, p_photo: photoId });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "retirer_photo" };
      const d = data as Record<string, unknown>;
      const resultat = d.resultat === "retiree" || d.resultat === "demande" || d.resultat === "deja_retiree" ? d.resultat : null;
      if (!resultat || typeof d.objet !== "string") return { erreur: "retirer_photo" };
      return { resultat, objet: d.objet };
    },
  };
}
