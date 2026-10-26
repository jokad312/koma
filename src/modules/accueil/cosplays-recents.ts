import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { listerCatalogue } from "@/modules/catalogue/queries";
import type { CarteProduit } from "@/modules/catalogue/types";
import { NB_COSPLAYS_ACCUEIL } from "./blocs";

const PARAMS_NOUVEAUTES = { univers: null, prixBas: null, prixHaut: null, dispo: null, tri: "nouveautes", curseur: null } as const;

// Les derniers cosplays publiés (tri nouveautés), lus à chaque requête (le badge dépend du stock : AD-17).
// Lecture en erreur : l'erreur est journalisée et la liste est vide (le bloc se masque), jamais une carte inventée.
export async function lireCosplaysRecents(locale: "fr" | "en"): Promise<CarteProduit[]> {
  // Attend la vraie requête : pendant le prérendu de la coque, Next.js annule les lectures non mises en cache et la lecture serait prise
  // pour une panne (bloc figé « absent » dans la coque). Ici le rendu s'arrête et reprend à la requête.
  await connection();
  try {
    const page = await listerCatalogue("cosplay", PARAMS_NOUVEAUTES, locale);
    return page.produits.slice(0, NB_COSPLAYS_ACCUEIL);
  } catch (e) {
    // Les signaux internes de Next.js (rendu dynamique, redirection) doivent remonter ; toute autre erreur masque le bloc.
    unstable_rethrow(e);
    console.error("[accueil] lecture des derniers cosplays impossible :", e instanceof Error ? `${e.name} ${e.message}` : "erreur inconnue");
    return [];
  }
}
