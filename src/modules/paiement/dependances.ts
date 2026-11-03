import "server-only";
import { randomBytes } from "node:crypto";
import { updateTag } from "next/cache";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { exigerDroit } from "@/lib/auth/droits";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { lireEnvPublique } from "@/lib/env";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import { adresseNotificationPrestataire, adresseRetourPrestataire } from "./etat";
import { ADAPTATEURS_BRANCHES, lireAdaptateur } from "./registre";
import { lireAchat, lireCouverture, lireExclus, lirePrestataires } from "./queries";
import type { DependancesCouverture } from "./couverture";
import type { DependancesAdminPaiement, DependancesOptions } from "./service";
import type { DependancesTentative } from "./tentative";
import type { CodePrestataire } from "./types";

export function dependancesOptions(): DependancesOptions {
  return { prestataires: lirePrestataires, achat: lireAchat, couverture: lireCouverture, exclus: lireExclus, adaptateursBranches: ADAPTATEURS_BRANCHES };
}

export function dependancesAdminPaiement(): DependancesAdminPaiement {
  const client = creerClientService();
  return {
    exigerDroit: () => exigerDroit("prestataires.gerer"),
    definirActif: async (auteur, code, actif) => {
      const { error } = await client.rpc("definir_prestataire_actif", { p_auteur: auteur as Json, p_code: code, p_actif: actif });
      return { erreur: error ? error.message : null };
    },
    deplacer: async (auteur, code, sens) => {
      const { error } = await client.rpc("deplacer_prestataire", { p_auteur: auteur as Json, p_code: code, p_sens: sens });
      return { erreur: error ? error.message : null };
    },
    invalider: async () => updateTag(ETIQUETTES.prestataires),
    adaptateursBranches: ADAPTATEURS_BRANCHES,
  };
}

export function dependancesCouverture(): DependancesCouverture {
  const client = creerClientService();
  return {
    exigerDroit: () => exigerDroit("prestataires.gerer"),
    ajouter: async (auteur, c) => {
      const { error } = await client.rpc("ajouter_couverture", { p_auteur: auteur as Json, p_prestataire: c.prestataire, p_pays: c.pays, p_operateur: c.operateur, p_source: c.source });
      return { erreur: error ? error.message : null };
    },
    confirmer: async (auteur, id) => {
      const { error } = await client.rpc("confirmer_couverture", { p_auteur: auteur as Json, p_id: id });
      return { erreur: error ? error.message : null };
    },
    retirer: async (auteur, id) => {
      const { error } = await client.rpc("retirer_couverture", { p_auteur: auteur as Json, p_id: id });
      return { erreur: error ? error.message : null };
    },
  };
}

// Lancement d'une Tentative (story 5.2) : tout passe par le client service, après la session vérifiée ; le navigateur ne fournit que son choix.
export function dependancesTentative(): DependancesTentative {
  const client = creerClientService();
  return {
    compteId: async () => (await lireSessionVerifiee())?.compteId ?? null,
    limiter: async (cle, fenetre, maximum) => {
      const { data, error } = await client.rpc("consommer_essai", { p_cle: cle, p_fenetre_secondes: fenetre, p_maximum: maximum });
      if (error) throw new Error("consommer_essai");
      return data === true;
    },
    commande: async (compteId, numero) => {
      const { data, error } = await client.from("commande").select("id").eq("numero", numero).eq("compte_id", compteId).maybeSingle();
      if (error) throw new Error("lecture de la commande");
      if (!data) return null;
      const [achat, utilisateur] = await Promise.all([lireAchat(data.id, compteId), client.auth.admin.getUserById(compteId)]);
      if (!achat) return null;
      const meta = utilisateur.data.user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
      const nom = [meta?.full_name, meta?.name].find((n): n is string => typeof n === "string" && n.trim().length > 0)?.trim() ?? null;
      return { id: data.id, achat, contact: { email: utilisateur.data.user?.email ?? null, nom } };
    },
    prestataires: lirePrestataires,
    couverture: lireCouverture,
    exclus: async (commandeId) => {
      const { data, error } = await client.from("tentative_paiement").select("prestataire").eq("commande_id", commandeId).eq("statut", "echouee").eq("cause", "prestataire");
      if (error) throw new Error("lecture des exclus");
      return [...new Set((data ?? []).map((l) => l.prestataire))] as CodePrestataire[];
    },
    adaptateursBranches: ADAPTATEURS_BRANCHES,
    adaptateur: lireAdaptateur,
    demarrer: async (a) => {
      const { data, error } = await client.rpc("demarrer_tentative", {
        p_compte: a.compteId,
        p_numero: a.numero,
        p_prestataire: a.prestataire,
        p_moyen: a.moyen,
        p_pays: a.pays as string,
        p_operateur: a.operateur as string,
        p_reference_interne: a.referenceInterne,
        p_telephone_masque: a.telephoneMasque as string,
      });
      if (error) return { erreur: error.message };
      const lu = data as { tentative_id: string; montant_attendu_cents: number };
      return { tentativeId: lu.tentative_id, montantAttenduCents: lu.montant_attendu_cents };
    },
    enregistrerInitiation: async (tentativeId, referenceTransaction) => {
      const { error } = await client.rpc("enregistrer_initiation", { p_tentative: tentativeId, p_reference_transaction: referenceTransaction });
      return { erreur: error ? error.message : null };
    },
    echouer: async (tentativeId, cause) => {
      await client.rpc("echouer_tentative", { p_tentative: tentativeId, p_cause: cause });
    },
    referenceInterne: (numero) => `${numero}-${randomBytes(6).toString("hex")}`,
    adresseRetour: (prestataire, numero) => adresseRetourPrestataire(lireEnvPublique().NEXT_PUBLIC_SITE_URL, prestataire, numero),
    adresseNotification: (prestataire) => adresseNotificationPrestataire(lireEnvPublique().NEXT_PUBLIC_SITE_URL, prestataire),
  };
}
