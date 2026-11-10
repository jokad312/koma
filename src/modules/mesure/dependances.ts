import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { AUTEUR_VISITEUR } from "@/lib/auth/auteur";
import { lireEnvPublique, lireEnvServeur } from "@/lib/env";
import { creerClientService } from "@/lib/supabase/service";
import type { DependancesMesure } from "./types";

// Accès réels de la mesure. `evenement_mesure` et sa fonction ne sont pas dans les types générés (fichier non modifiable
// ici) : le client est décrit localement, comme pour les autres tables récentes.
type ClientMesure = {
  rpc: (nom: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

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
  const admin = creerClientService() as unknown as ClientMesure;
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
        p_auteur: AUTEUR_VISITEUR as never,
        p_action: action,
        p_page: page,
        p_origine: origine as never,
        p_referent: referent as never,
        p_langue: langue,
        p_appareil: appareil,
        p_session: session,
        p_duree_ms: dureeMs as never,
      });
      return { erreur: error ? error.message : null };
    },
  };
}
