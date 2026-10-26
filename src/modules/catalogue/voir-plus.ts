"use server";

import { analyserRequete } from "./adresse";
import { listerCatalogue } from "./queries";
import { FAMILLES_PHYSIQUES } from "./types";
import type { CarteProduit, FamillePhysique } from "./types";

// Action du bouton « Voir plus » : les 12 produits suivants. Rendue à chaque requête (jamais en cache : le badge dépend du stock).
// Les trois arguments viennent du navigateur : ils sont revalidés ici (famille, langue, requête analysée sans jamais échouer).
export type ResultatVoirPlus = { ok: true; produits: CarteProduit[]; suite: string | null } | { ok: false };

export async function chargerPlusProduits(famille: string, requete: string, locale: string): Promise<ResultatVoirPlus> {
  if (!(FAMILLES_PHYSIQUES as readonly string[]).includes(famille)) return { ok: false };
  if (locale !== "fr" && locale !== "en") return { ok: false };
  if (typeof requete !== "string" || requete.length > 1000) return { ok: false };
  try {
    const page = await listerCatalogue(famille as FamillePhysique, analyserRequete(new URLSearchParams(requete)), locale);
    return { ok: true, produits: page.produits, suite: page.suite };
  } catch {
    // Jamais une liste vide inventée : l'interface affiche une erreur et garde le lien « Voir plus ».
    console.error("[catalogue] voir plus : lecture impossible");
    return { ok: false };
  }
}
