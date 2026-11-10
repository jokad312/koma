import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { AUTEUR_VISITEUR } from "@/lib/auth/auteur";
import { lireEnvPublique, lireEnvServeur } from "@/lib/env";
import { creerClientService } from "@/lib/supabase/service";
import type { DependancesMesure } from "./types";

// Accès réels de la mesure, par le client typé (noms des fonctions et des paramètres vérifiés à la compilation).
// Les types générés ne savent pas qu'un paramètre SQL sans valeur par défaut accepte null : origine et référent nuls sont
// donc convertis explicitement.
const nul = (valeur: string | null) => valeur as string;

// Hôte du site, lu dans NEXT_PUBLIC_SITE_URL : jamais dans Host ni X-Forwarded-Host (deux en-têtes que le client fixe).
export function hoteDuSite(site: string): string | null {
  try {
    return new URL(site).host.toLowerCase();
  } catch {
    return null;
  }
}

// Adresse ajoutée par le proxy de l'hébergeur : la DERNIÈRE de X-Forwarded-For (les précédentes viennent du client).
export function derniereAdresse(entete: string | null): string | null {
  const adresses = (entete ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  return adresses.at(-1) ?? null;
}

export function dependancesMesure(): DependancesMesure {
  const admin = creerClientService();
  // Hachage à clé (la clé secrète du serveur) : ni l'adresse IP ni une valeur brute ne sont stockées ou journalisées.
  const hacher = (valeur: string) => createHmac("sha256", lireEnvServeur().SUPABASE_SECRET_KEY).update(valeur).digest("hex");
  return {
    referer: async () => (await headers()).get("referer"),
    hote: async () => hoteDuSite(lireEnvPublique().NEXT_PUBLIC_SITE_URL),
    empreinteClient: async () => {
      const ip = derniereAdresse((await headers()).get("x-forwarded-for"));
      return ip ? hacher(ip) : null;
    },
    consommerEssai: async ({ cle, fenetreSecondes, maximum }) => {
      const { data, error } = await admin.rpc("consommer_essai", {
        p_cle: cle,
        p_fenetre_secondes: fenetreSecondes,
        p_maximum: maximum,
      });
      if (error) throw new Error("consommer_essai");
      return data === true;
    },
    enregistrer: async ({ action, page, origine, referent, langue, appareil, session, dureeMs }) => {
      const { error } = await admin.rpc("enregistrer_evenement_mesure", {
        p_auteur: AUTEUR_VISITEUR,
        p_action: action,
        p_page: page,
        p_origine: nul(origine),
        p_referent: nul(referent),
        p_langue: langue,
        p_appareil: appareil,
        p_session: session,
        p_duree_ms: dureeMs ?? undefined,
      });
      return { erreur: error ? error.message : null };
    },
  };
}
