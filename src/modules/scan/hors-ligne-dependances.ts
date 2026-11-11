import "server-only";
import { createHmac } from "node:crypto";
import { lireEnvServeur } from "@/lib/env";
import type { AuteurCompte } from "@/lib/auth/auteur";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { exigerAccesScan, exigerDroit } from "@/lib/auth/droits";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import type { DependancesHorsLigne, RetourBase } from "./hors-ligne-service";
import type { AuteurScan } from "./types";

const codeKs = (message: string, code: string | undefined) => /KS_[A-Z_]+/.exec(message)?.[0] ?? (code || "inconnu");
const enAuteur = (a: AuteurCompte): AuteurScan => ({ type: "compte", id: a.id, role: a.role });
const enJson = (a: AuteurScan) => a as unknown as Json;

// Les vrais clients donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependancesHorsLigne(): DependancesHorsLigne {
  const admin = creerClientService();
  const retour = (r: { data: unknown; error: { message: string; code?: string } | null }): RetourBase =>
    r.error ? { erreur: codeKs(r.error.message, r.error.code), reponse: null } : { erreur: null, reponse: r.data };
  return {
    exigerAcces: async (evenementId) => ({ auteur: enAuteur((await exigerAccesScan(evenementId)).auteur) }),
    exigerSession: async () => {
      const session = await lireSessionVerifiee();
      if (!session) throw new Error("KS_NON_CONNECTE");
      // Le rôle écrit ici n'est jamais cru par la base : tout est revérifié en base.
      return { auteur: { type: "compte", id: session.compteId, role: null } };
    },
    exigerAdmin: async () => ({ auteur: enAuteur((await exigerDroit("evenements.gerer")).auteur) }),
    prendre: async ({ auteur, evenementId, appareil }) =>
      retour(await admin.rpc("prendre_verrou", { p_auteur: enJson(auteur), p_evenement: evenementId, p_appareil: appareil })),
    telecharger: async ({ auteur, evenementId, appareil }) =>
      retour(await admin.rpc("telecharger_liste_hors_ligne", { p_auteur: enJson(auteur), p_evenement: evenementId, p_appareil: appareil })),
    synchroniser: async ({ auteur, evenementId, appareil, scans }) =>
      retour(await admin.rpc("synchroniser_scans", { p_auteur: enJson(auteur), p_evenement: evenementId, p_appareil: appareil, p_scans: scans as unknown as Json })),
    liberer: async ({ auteur, evenementId, appareil }) =>
      retour(await admin.rpc("liberer_verrou", { p_auteur: enJson(auteur), p_evenement: evenementId, p_appareil: appareil })),
    lireEtat: async ({ auteur, evenementId, appareil }) =>
      retour(await admin.rpc("lire_etat_verrou", { p_auteur: enJson(auteur), p_evenement: evenementId, p_appareil: appareil })),
    consommerEssai: async ({ cle, fenetreSecondes, maximum }) => {
      const { data, error } = await admin.rpc("consommer_essai", { p_cle: cle, p_fenetre_secondes: fenetreSecondes, p_maximum: maximum });
      return { erreur: error ? codeKs(error.message, error.code) : null, autorise: data === true };
    },
    empreinteValeur: (valeur) => createHmac("sha256", lireEnvServeur().SUPABASE_SECRET_KEY).update(valeur).digest("hex"),
    forcer: async ({ auteur, evenementId }) => retour(await admin.rpc("forcer_liberation_verrou", { p_auteur: enJson(auteur), p_evenement: evenementId })),
  };
}
