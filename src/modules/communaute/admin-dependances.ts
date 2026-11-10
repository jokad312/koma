import "server-only";
import { updateTag } from "next/cache";
import { exigerDroit } from "@/lib/auth/droits";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_ATTENTE, BUCKET_PUBLIC, urlPhotoPublique } from "@/lib/supabase/stockage";
import { BUCKET_ACCORDS } from "./admin-types";
import type { DependancesGalerie, PhotoAdmin } from "./admin-types";
import { VERSION_ACCORD_PUBLICATION } from "./types";

const DUREE_APERCU_SECONDES = 600;

function lireRealisation(r: unknown): PhotoAdmin["realisation"] {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const v = r as Record<string, unknown>;
  if (typeof v.kit_fr !== "string" || typeof v.commande !== "string" || typeof v.paye_le !== "string") return null;
  return { kitFr: v.kit_fr, kitEn: typeof v.kit_en === "string" ? v.kit_en : null, commande: v.commande, payeLe: v.paye_le, rang: typeof v.rang === "number" ? v.rang : null };
}

// Les vrais accès du personnel (en test, des faux nommés TEST_ les remplacent). Toutes les fonctions SQL vérifient aussi le rôle.
export function dependancesGalerie(): DependancesGalerie {
  const admin = creerClientService();
  return {
    exigerDroit: () => exigerDroit("galerie.valider"),
    lister: async (auteur) => {
      const { data, error } = await admin.rpc("lister_photos_admin", { p_auteur: auteur as never });
      if (error || !Array.isArray(data)) return { erreur: error?.message ?? "lister_photos_admin" };
      const objets: Record<string, { objet: string; fichierPublic: string | null }> = {};
      const photos: Omit<PhotoAdmin, "apercu">[] = [];
      for (const p of data as Record<string, unknown>[]) {
        if (typeof p.id !== "string" || (p.statut !== "en_attente" && p.statut !== "publiee") || typeof p.cree_le !== "string" || typeof p.objet !== "string") continue;
        objets[p.id] = { objet: p.objet, fichierPublic: typeof p.fichier_public === "string" ? p.fichier_public : null };
        photos.push({
          id: p.id,
          statut: p.statut,
          source: p.source === "whatsapp" ? "whatsapp" : "compte",
          nomAffiche: typeof p.nom_affiche === "string" ? p.nom_affiche : null,
          ville: typeof p.ville === "string" ? p.ville : null,
          retraitDemande: typeof p.retrait_demande_le === "string",
          creeLe: p.cree_le,
          accordWhatsappLe: typeof p.accord_whatsapp_le === "string" ? p.accord_whatsapp_le : null,
          capture: p.capture === true,
          realisation: lireRealisation(p.realisation),
        });
      }
      return { photos, objets };
    },
    apercusPrives: async (objets) => {
      const { data, error } = await admin.storage.from(BUCKET_ATTENTE).createSignedUrls(objets, DUREE_APERCU_SECONDES);
      if (error || !data) return {};
      return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
    },
    urlPublique: (fichier) => urlPhotoPublique(fichier),
    lirePhoto: async (id) => {
      const { data, error } = await admin.from("photo_galerie").select("objet, statut, fichier_public").eq("id", id).maybeSingle();
      if (error) return { erreur: error.message };
      return data ? { objet: data.objet, statut: data.statut, fichierPublic: data.fichier_public } : null;
    },
    lireAttente: async (objet) => {
      const { data, error } = await admin.storage.from(BUCKET_ATTENTE).download(objet);
      if (error || !data) return { erreur: error?.message ?? "objet absent" };
      return { octets: new Uint8Array(await data.arrayBuffer()) };
    },
    ecrireAttente: async ({ objet, octets, contentType }) => {
      const { error } = await admin.storage.from(BUCKET_ATTENTE).upload(objet, octets, { contentType, upsert: false });
      return { erreur: error ? error.message : null };
    },
    ecrirePublic: async ({ fichier, octets, contentType }) => {
      const { error } = await admin.storage.from(BUCKET_PUBLIC).upload(fichier, octets, { contentType, upsert: false, cacheControl: "31536000" });
      return { erreur: error ? error.message : null };
    },
    ecrireCapture: async ({ fichier, octets, contentType }) => {
      const { error } = await admin.storage.from(BUCKET_ACCORDS).upload(fichier, octets, { contentType, upsert: false });
      return { erreur: error ? error.message : null };
    },
    supprimerAttente: async (objet) => {
      const { error } = await admin.storage.from(BUCKET_ATTENTE).remove([objet]);
      return { erreur: error ? error.message : null };
    },
    supprimerPublic: async (fichier) => {
      const { error } = await admin.storage.from(BUCKET_PUBLIC).remove([fichier]);
      return { erreur: error ? error.message : null };
    },
    supprimerCapture: async (fichier) => {
      const { error } = await admin.storage.from(BUCKET_ACCORDS).remove([fichier]);
      return { erreur: error ? error.message : null };
    },
    signerEnvoiAdmin: async (objet) => {
      const { data, error } = await admin.storage.from(BUCKET_ATTENTE).createSignedUploadUrl(objet);
      return error || !data?.token ? { erreur: error?.message ?? "jeton absent" } : { jeton: data.token };
    },
    valider: async (auteur, id, fichierPublic, alt) => {
      const { error } = await admin.rpc("valider_photo", { p_auteur: auteur as never, p_photo: id, p_fichier_public: fichierPublic, p_alt_fr: alt.altFr, p_alt_en: alt.altEn });
      return { erreur: error ? error.message : null };
    },
    refuser: async (auteur, id) => {
      const { data, error } = await admin.rpc("refuser_photo", { p_auteur: auteur as never, p_photo: id });
      if (error || typeof data !== "string") return { erreur: error?.message ?? "refuser_photo" };
      return { objet: data };
    },
    retirer: async (auteur, id) => {
      const { data, error } = await admin.rpc("retirer_photo_admin", { p_auteur: auteur as never, p_photo: id });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "retirer_photo_admin" };
      const d = data as Record<string, unknown>;
      if (typeof d.objet !== "string") return { erreur: "retirer_photo_admin" };
      return { objet: d.objet, fichierPublic: typeof d.fichier_public === "string" ? d.fichier_public : null };
    },
    trouverCompte: async (auteur, email) => {
      const { data, error } = await admin.rpc("trouver_compte_par_email", { p_auteur: auteur as never, p_email: email });
      if (error) return { erreur: error.message };
      return { compteId: typeof data === "string" ? data : null };
    },
    deposer: async ({ auteur, objet, compteId, nom, ville, accordLe, majeur, capture }) => {
      const { data, error } = await admin.rpc("deposer_photo_whatsapp", {
        p_auteur: auteur as never,
        p_objet: objet,
        p_compte: compteId as never,
        p_nom: nom as never,
        p_ville: ville as never,
        p_accord_le: accordLe,
        p_majeur: majeur,
        p_capture: capture as never,
        p_version: VERSION_ACCORD_PUBLICATION,
      });
      if (error || typeof data !== "string") return { erreur: error?.message ?? "deposer_photo_whatsapp" };
      return { id: data };
    },
    invaliderGalerie: () => updateTag(ETIQUETTES.galerie),
  };
}
