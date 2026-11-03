import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import { lireAdaptateur } from "./registre";
import type { DependancesConfirmation, TentativeLue } from "./confirmation";
import { CODES_PRESTATAIRE, type CodePrestataire } from "./types";

const AUTEUR = { type: "systeme", nom: "paiement" } as const;

function versCode(c: string): CodePrestataire | null {
  return (CODES_PRESTATAIRE as readonly string[]).includes(c) ? (c as CodePrestataire) : null;
}

type LigneTentative = {
  id: string;
  prestataire: string;
  statut: string;
  reference_interne: string;
  reference_transaction: string | null;
  montant_attendu_cents: number;
  commande_numero?: string;
};

function versTentative(l: LigneTentative): TentativeLue | null {
  const prestataire = versCode(l.prestataire);
  if (!prestataire) return null;
  return {
    id: l.id,
    prestataire,
    statut: l.statut,
    referenceInterne: l.reference_interne,
    referenceTransaction: l.reference_transaction,
    montantAttenduCents: l.montant_attendu_cents,
    commandeNumero: l.commande_numero,
  };
}

// Accès base du socle de confirmation : client service, après la vérification du Prestataire (jamais depuis le navigateur). Les adaptateurs sont
// lus même s'ils ne sont pas activables : une notification ou une réconciliation doit pouvoir aboutir après une désactivation.
export function dependancesConfirmation(): DependancesConfirmation {
  const client = creerClientService();
  return {
    adaptateur: lireAdaptateur,
    tentativeParReference: async (reference) => {
      const { data, error } = await client.rpc("tentative_par_reference_interne", { p_reference: reference });
      if (error) throw new Error("lecture de la Tentative");
      return data ? versTentative(data as LigneTentative) : null;
    },
    enregistrerNotification: async (prestataire, idNotification, tentativeId, signatureValide) => {
      const { data, error } = await client.rpc("enregistrer_notification", {
        p_prestataire: prestataire,
        p_id_notification: idNotification,
        p_tentative: tentativeId as string,
        p_signature_valide: signatureValide,
      });
      if (error) throw new Error("enregistrement de la notification");
      return data === true;
    },
    confirmer: async (tentativeId, comparaison, montantRecu, deviseRecue, referenceTransaction) => {
      const { data, error } = await client.rpc("confirmer_paiement", {
        p_auteur: AUTEUR,
        p_tentative: tentativeId,
        p_comparaison: comparaison,
        p_montant_recu: montantRecu,
        p_devise_recue: deviseRecue,
        p_reference_transaction: referenceTransaction,
      });
      if (error) return { erreur: error.message };
      return { resultat: String((data as { resultat?: unknown } | null)?.resultat ?? "") };
    },
    echouer: async (tentativeId, cause) => {
      const { error } = await client.rpc("echouer_tentative", { p_tentative: tentativeId, p_cause: cause });
      if (error) throw new Error("échec de la Tentative");
    },
    toucher: async (tentativeId) => {
      const { error } = await client.rpc("toucher_tentative", { p_tentative: tentativeId });
      if (error) throw new Error("mise à jour de la Tentative");
    },
    signalerIndetermine: async (tentativeId, montantRecu, deviseRecue) => {
      const { error } = await client.rpc("signaler_montant_indetermine", { p_tentative: tentativeId, p_montant_recu: montantRecu, p_devise_recue: deviseRecue });
      if (error) throw new Error("signalement du montant");
    },
    abandonnerPerimees: async () => {
      const { data, error } = await client.rpc("abandonner_tentatives_perimees");
      if (error) throw new Error("abandon des Tentatives périmées");
      return typeof data === "number" ? data : 0;
    },
    lot: async (limite, delaiSecondes) => {
      const { data, error } = await client.rpc("tentatives_a_reconcilier", { p_limite: limite, p_delai_secondes: delaiSecondes });
      if (error) throw new Error("lecture du lot");
      return (data ?? []).flatMap((l) => {
        const t = versTentative(l);
        return t ? [t] : [];
      });
    },
  };
}
