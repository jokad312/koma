import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { exigerAccesScan } from "@/lib/auth/droits";
import { lireEnvServeur } from "@/lib/env";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import { lireReponse } from "./service";
import type { DependancesScan } from "./types";

const codeKs = (message: string, code: string | undefined) => /KS_[A-Z_]+/.exec(message)?.[0] ?? (code || "inconnu");

// Les vrais clients donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependancesScan(): DependancesScan {
  const admin = creerClientService();
  const hacher = (valeur: string) => createHmac("sha256", lireEnvServeur().SUPABASE_SECRET_KEY).update(valeur).digest("hex");
  return {
    exigerAcces: async (evenementId) => {
      const { auteur } = await exigerAccesScan(evenementId);
      return { auteur: { type: "compte", id: auteur.id, role: auteur.role } };
    },
    empreinteValeur: hacher,
    empreinteClient: async () => {
      const h = await headers();
      const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
      return ip ? hacher(ip) : null;
    },
    consommerEssai: async ({ cle, fenetreSecondes, maximum }) => {
      const { data, error } = await admin.rpc("consommer_essai", { p_cle: cle, p_fenetre_secondes: fenetreSecondes, p_maximum: maximum });
      return { erreur: error ? codeKs(error.message, error.code) : null, autorise: data === true };
    },
    scanner: async ({ auteur, evenementId, jeton, code, appareil }) => {
      // La fonction attend un argument absent plutôt que null : on n'envoie que celui qui existe.
      const { data, error } = await admin.rpc("scanner_pass", {
        // L'appareil voyage dans l'auteur : la base le compare au Verrou hors ligne et ne l'écrit jamais au journal.
        p_auteur: (appareil ? { ...auteur, appareil } : auteur) as unknown as Json,
        p_evenement: evenementId,
        ...(jeton ? { p_jeton: jeton } : {}),
        ...(code ? { p_code: code } : {}),
      });
      // Seule la cause est renvoyée : le code KS_ du refus, sinon le code SQL. Jamais une valeur saisie.
      if (error) return { erreur: codeKs(error.message, error.code), reponse: null };
      return { erreur: null, reponse: lireReponse(data) };
    },
  };
}
