import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import type { AuteurCompte } from "@/lib/auth/auteur";
import { CompteRefuseError, exigerCompteComplet } from "@/lib/auth/compte";
import { exigerDroit } from "@/lib/auth/droits";
import { lireEnvServeur } from "@/lib/env";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import type { DependancesAlertes, DependancesExportAlertes, NombresAlertes } from "./types";

const codeKs = (message: string, code: string | undefined) => /KS_[A-Z_]+/.exec(message)?.[0] ?? (code || "inconnu");

// Les vrais clients donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependancesAlertes(): DependancesAlertes {
  const admin = creerClientService();
  const hacher = (valeur: string) => createHmac("sha256", lireEnvServeur().SUPABASE_SECRET_KEY).update(valeur).digest("hex");
  return {
    compte: async () => {
      try {
        const { compteId, auteur } = await exigerCompteComplet();
        return { compteId, auteur: auteur as AuteurCompte };
      } catch (e) {
        if (e instanceof CompteRefuseError) {
          if (e.code === "KS_NON_CONNECTE") return null;
          // Compte incomplet : annoncé par le service ; vérification impossible (panne) : échec générique.
          throw new Error(e.code);
        }
        throw e;
      }
    },
    empreinteValeur: hacher,
    empreinteClient: async () => {
      const h = await headers();
      const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
      return ip ? hacher(ip) : null;
    },
    consommerEssai: async ({ cle, fenetreSecondes, maximum }) => {
      const { data, error } = await admin.rpc("consommer_essai", { p_cle: cle, p_fenetre_secondes: fenetreSecondes, p_maximum: maximum });
      return { erreur: error ? error.message : null, autorise: data === true };
    },
    inscrire: async ({ auteur, evenementId, canal, valeur, langue, version }) => {
      const { error } = await admin.rpc("inscrire_alerte_evenement", {
        p_auteur: auteur as unknown as Json,
        p_evenement: evenementId,
        p_canal: canal,
        // La fonction accepte null (canal Compte) ; le type généré ne marque pas l'argument comme nul.
        p_valeur: valeur as unknown as string,
        p_langue: langue,
        p_version: version,
      });
      // Seule la cause est renvoyée : le code KS_ du refus, sinon le code SQL. Jamais une valeur saisie.
      return { erreur: error ? codeKs(error.message, error.code) : null };
    },
    planifier: async () => {
      const { data, error } = await admin.rpc("planifier_alertes_evenements");
      return { erreur: error ? error.message : null, nombre: typeof data === "number" ? data : 0 };
    },
  };
}

export function dependancesExportAlertes(): DependancesExportAlertes {
  const admin = creerClientService();
  return {
    exigerDroit,
    exporterNumeros: async ({ auteur, evenementId }) => {
      const { data, error } = await admin.rpc("exporter_alertes_whatsapp", { p_auteur: auteur as unknown as Json, p_evenement: evenementId });
      if (error) return { erreur: codeKs(error.message, error.code), numeros: [] };
      return { erreur: null, numeros: Array.isArray(data) ? data.filter((n): n is string => typeof n === "string") : [] };
    },
  };
}

// Page admin : nombre d'inscrits actifs par canal. Une erreur est relancée (jamais des zéros inventés).
export async function lireNombresAlertes(auteur: AuteurCompte, evenementId: string): Promise<NombresAlertes> {
  const { data, error } = await creerClientService().rpc("compter_alertes_evenement", { p_auteur: auteur as unknown as Json, p_evenement: evenementId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Lecture des alertes impossible.");
  const n = data as Record<string, unknown>;
  const nombre = (v: unknown) => (typeof v === "number" ? v : 0);
  return { email: nombre(n.email), compte: nombre(n.compte), whatsapp: nombre(n.whatsapp), desinscrits: nombre(n.desinscrits) };
}
