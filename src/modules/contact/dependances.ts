import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { lireEnvServeur } from "@/lib/env";
import { creerClientService } from "@/lib/supabase/service";
import type { DependancesContact } from "./types";

// Les vrais clients donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependances(): DependancesContact {
  const admin = creerClientService();
  // Hachage à clé (la clé secrète du serveur) : ni l'adresse IP ni l'email bruts ne sont stockés ni journalisés.
  const hacher = (valeur: string) => createHmac("sha256", lireEnvServeur().SUPABASE_SECRET_KEY).update(valeur).digest("hex");
  return {
    empreinteValeur: hacher,
    empreinteClient: async () => {
      const h = await headers();
      const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
      if (!ip) return null;
      return hacher(ip);
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
