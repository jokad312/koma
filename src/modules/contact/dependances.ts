import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { lireEnvServeur } from "@/lib/env";
import { creerClientService } from "@/lib/supabase/service";
import type { DependancesContact } from "./types";

// Les vrais clients donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependances(): DependancesContact {
  const admin = creerClientService();
  return {
    empreinteClient: async () => {
      const h = await headers();
      const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
      if (!ip) return null;
      // Hachage à clé (la clé secrète du serveur) : l'adresse brute n'est ni stockée ni journalisée.
      return createHmac("sha256", lireEnvServeur().SUPABASE_SECRET_KEY).update(ip).digest("hex");
    },
    consommerEssai: async ({ cle, fenetreSecondes, maximum }) => {
      const { data, error } = await admin.rpc("consommer_essai", { p_cle: cle, p_fenetre_secondes: fenetreSecondes, p_maximum: maximum });
      return { erreur: error ? error.message : null, autorise: data === true };
    },
    enregistrerMessage: async ({ auteur, nom, email, message, langue }) => {
      const { error } = await admin.rpc("enregistrer_message_contact", {
        p_auteur: auteur as never,
        p_nom: nom,
        p_email: email,
        p_message: message,
        p_langue: langue,
      });
      return { erreur: error ? error.message : null };
    },
  };
}
