import "server-only";
import { CompteRefuseError, exigerCompteComplet } from "@/lib/auth/compte";
import { creerClientService } from "@/lib/supabase/service";
import { OBJETS_CASE_EMAILS, VERSION_CONSENTEMENT_EMAILS } from "./types";
import type { DependancesPreferences } from "./types";

// Les vrais appels (en test, des faux nommés TEST_ les remplacent). Toutes les fonctions SQL sont réservées au serveur.
export function dependancesPreferences(): DependancesPreferences {
  return {
    compte: async () => {
      try {
        const { compteId, auteur } = await exigerCompteComplet();
        return { compteId, auteur };
      } catch (e) {
        // Vérification impossible (panne) : relancée, jamais prise pour « non connecté ».
        if (e instanceof CompteRefuseError && e.message !== "KS_VERIFICATION_IMPOSSIBLE") return null;
        throw e;
      }
    },
    lire: async (compteId) => {
      const { data, error } = await creerClientService().rpc("lire_preferences", { p_compte: compteId });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "lire_preferences" };
      const p = data as Record<string, unknown>;
      return {
        preferences: { relances: p.relances === true, nouveautes: p.nouveautes === true, alertesFestival: p.alertes_festival === true, mineurBloque: p.mineur_bloque === true },
      };
    },
    regler: async (auteur, objet, actif) => {
      const { data, error } = await creerClientService().rpc("regler_preference", {
        p_auteur: auteur as never,
        p_objet: objet,
        p_actif: actif,
        p_version: VERSION_CONSENTEMENT_EMAILS,
      });
      if (error || typeof data !== "boolean") return { erreur: error?.message ?? "regler_preference" };
      return { actif: data };
    },
    desinscrire: async (compteId) => {
      const { data, error } = await creerClientService().rpc("desinscrire", { p_compte: compteId });
      if (error || typeof data !== "boolean") return { erreur: error?.message ?? "desinscrire" };
      return { fait: data };
    },
    desinscrireAlerte: async (alerteId) => {
      const { data, error } = await creerClientService().rpc("desinscrire_alerte", { p_alerte: alerteId });
      if (error || typeof data !== "boolean") return { erreur: error?.message ?? "desinscrire_alerte" };
      return { fait: data };
    },
  };
}

// Case « Emails commerciaux » de la création de Compte et de l'étape de commande : un échec est journalisé, il ne bloque jamais
// ni la connexion ni la Commande (la case est facultative). Renvoie vrai si la base a enregistré le consentement.
export async function donnerConsentementEmails(auteur: unknown, source: "creation_compte" | "commande"): Promise<boolean> {
  try {
    const { error } = await creerClientService().rpc("donner_consentements", {
      p_auteur: auteur as never,
      p_objets: [...OBJETS_CASE_EMAILS],
      p_version: VERSION_CONSENTEMENT_EMAILS,
      p_source: source,
    });
    if (error) console.error("[preferences] consentement : échec");
    return !error;
  } catch {
    console.error("[preferences] consentement : échec");
    return false;
  }
}
