import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { listerCatalogue } from "@/modules/catalogue/queries";
import type { CarteProduit, FamilleProduit } from "@/modules/catalogue/types";
import { choisirCartesHeros, type CartesHeros } from "./heros-cartes-choix";

const PARAMS_NOUVEAUTES = { univers: null, niveau: null, prixBas: null, prixHaut: null, dispo: null, tri: "nouveautes", curseur: null } as const;

// Les plus récents d'une famille (tri nouveautés, produits publiés seulement : RLS). Lecture en erreur : journalisée, liste vide
// (la carte est alors masquée), jamais une carte inventée.
async function lireRecents(famille: FamilleProduit, locale: "fr" | "en"): Promise<CarteProduit[]> {
  try {
    const page = await listerCatalogue(famille, PARAMS_NOUVEAUTES, locale);
    return page.produits;
  } catch (e) {
    unstable_rethrow(e);
    console.error(`[accueil] lecture des cartes du héros (${famille}) impossible :`, e instanceof Error ? `${e.name} ${e.message}` : "erreur inconnue");
    return [];
  }
}

// Rangée de cartes du héros : un cosplay, un accessoire et le « Kit du mois », tous publiés, lus à chaque requête (badge et prix en base).
export async function lireCartesHeros(locale: "fr" | "en", slugVedette: string | null): Promise<CartesHeros> {
  await connection();
  const [cosplays, accessoires, kits] = await Promise.all([lireRecents("cosplay", locale), lireRecents("accessoire", locale), lireRecents("kit", locale)]);
  return choisirCartesHeros({ cosplays, accessoires, kits, slugVedette });
}
