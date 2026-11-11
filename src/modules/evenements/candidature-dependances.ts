import "server-only";
import { getTranslations } from "next-intl/server";
import { CompteRefuseError, exigerCompteComplet } from "@/lib/auth/compte";
import { creerClientService } from "@/lib/supabase/service";
import { BUCKET_CANDIDATURES_STAND } from "@/lib/supabase/stockage";
import type { Json } from "@/lib/supabase/types";
import { LIMITE_DEMANDES_CANDIDATURE_PAR_HEURE } from "./candidature-types";
import type { DependancesCandidature, DependancesNommerAide, DependancesPaiementStand, RecapStandBrut } from "./candidature-types";

async function compteOuRaison(): ReturnType<DependancesCandidature["compte"]> {
  try {
    return await exigerCompteComplet();
  } catch (e) {
    if (e instanceof CompteRefuseError && e.code === "KS_NON_CONNECTE") return { erreur: "non_connecte" };
    if (e instanceof CompteRefuseError && e.code === "KS_COMPTE_INCOMPLET") return { erreur: "compte_incomplet" };
    throw e;
  }
}

// Les vrais accès donnés au service de candidature (en test, des faux nommés TEST_ les remplacent). Tout passe par le client service, côté serveur.
export function dependancesCandidature(): DependancesCandidature {
  const admin = creerClientService();
  const bucket = () => admin.storage.from(BUCKET_CANDIDATURES_STAND);
  return {
    compte: compteOuRaison,
    consommerEssai: async (cle) => {
      const { data, error } = await admin.rpc("consommer_essai", { p_cle: cle, p_fenetre_secondes: 3600, p_maximum: LIMITE_DEMANDES_CANDIDATURE_PAR_HEURE });
      return error ? { erreur: error.message } : { autorise: data === true };
    },
    verifierPossible: async ({ compteId, evenementId, typePassId }) => {
      const { data, error } = await admin.rpc("candidature_stand_possible", { p_compte: compteId, p_evenement: evenementId, p_type: typePassId });
      return error ? { erreur: error.message } : { obstacle: typeof data === "string" ? data : null };
    },
    signerEnvoi: async (objet) => {
      const { data, error } = await bucket().createSignedUploadUrl(objet);
      return error || !data?.token ? { erreur: error?.message ?? "jeton absent" } : { jeton: data.token };
    },
    lireObjet: async (objet) => {
      const { data, error } = await bucket().download(objet);
      if (error || !data) return { erreur: error?.message ?? "objet absent" };
      return { octets: new Uint8Array(await data.arrayBuffer()) };
    },
    ecrireObjet: async ({ objet, octets, contentType }) => {
      const { error } = await bucket().upload(objet, octets, { contentType, upsert: false });
      return { erreur: error ? error.message : null };
    },
    supprimerObjet: async (objet) => {
      const { error } = await bucket().remove([objet]);
      return { erreur: error ? error.message : null };
    },
    deposer: async ({ auteur, id, evenementId, typePassId, description, instagram, photos, versionEngagement }) => {
      const { data, error } = await admin.rpc("deposer_candidature_stand", {
        p_auteur: auteur as unknown as Json,
        p_id: id,
        p_evenement: evenementId,
        p_type: typePassId,
        p_description: description,
        p_instagram: instagram,
        p_photos: photos,
        p_engagement_version: versionEngagement,
      });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "deposer_candidature_stand" };
      const r = data as Record<string, unknown>;
      return typeof r.expire_le === "string" ? { expireLe: r.expire_le } : { erreur: "deposer_candidature_stand" };
    },
  };
}

// Paiement d'un Stand accepté : mêmes accès que l'achat de Pass pour le Compte et son nom ; les fonctions de la base sont celles de la 7.11.
export function dependancesPaiementStand(): DependancesPaiementStand {
  const admin = creerClientService();
  return {
    exigerCompte: exigerCompteComplet,
    nomDuCompte: async (compteId) => {
      const utilisateur = await admin.auth.admin.getUserById(compteId);
      const meta = utilisateur.data.user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
      return [meta?.full_name, meta?.name].find((n): n is string => typeof n === "string" && n.trim().length > 0)?.trim() ?? null;
    },
    nomAideProvisoire: async (langue) => (await getTranslations({ locale: langue, namespace: "Festival.stand" }))("aideProvisoire"),
    recapitulatif: async ({ compteId, candidatureId, code }) => {
      const { data, error } = await admin.rpc("recapitulatif_commande_stand", { p_compte: compteId, p_candidature: candidatureId, p_code: code as never });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "recapitulatif_commande_stand" };
      return { recap: data as unknown as RecapStandBrut };
    },
    creerCommande: async ({ auteur, candidatureId, acceptations, totalAttenduCents, cleIdempotence, nomTitulaire, nomAide, aideASaisir, code }) => {
      const { data, error } = await admin.rpc("creer_commande_stand", {
        p_auteur: auteur as unknown as Json,
        p_candidature: candidatureId,
        p_acceptations: acceptations as unknown as Json,
        p_total_attendu_cents: totalAttenduCents,
        p_cle_idempotence: cleIdempotence,
        p_nom_titulaire: nomTitulaire,
        p_nom_aide: nomAide,
        p_aide_a_saisir: aideASaisir,
        p_code: code as never,
      });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "creer_commande_stand" };
      const r = data as Record<string, unknown>;
      return typeof r.numero === "string" && typeof r.expire_le === "string" ? { numero: r.numero, expireLe: r.expire_le } : { erreur: "creer_commande_stand" };
    },
  };
}

export function dependancesNommerAide(): DependancesNommerAide {
  const admin = creerClientService();
  return {
    compte: compteOuRaison,
    nommer: async ({ auteur, passId, nom }) => {
      const { error } = await admin.rpc("nommer_aide_pass", { p_auteur: auteur as unknown as Json, p_pass: passId, p_nom: nom });
      return { erreur: error ? error.message : null };
    },
  };
}
