import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { listerCatalogue } from "@/modules/catalogue/queries";
import type { CarteProduit } from "@/modules/catalogue/types";

const PARAMS_KITS = { univers: null, niveau: null, prixBas: null, prixHaut: null, dispo: null, tri: "nouveautes", curseur: null } as const;

// Les Kits publiés (tri nouveautes), lus à chaque requête : le bloc du 3 « Kits » s'affiche tant qu'au moins un Kit est publié.
// Le Kit gratuit (prix 0) est en évidence dans le bloc ; un bloc sans Kit publié n'existe pas (aucun contenu inventé).
export async function lireKits(locale: "fr" | "en"): Promise<CarteProduit[]> {
  await connection();
  try {
    const page = await listerCatalogue("kit", PARAMS_KITS, locale);
    return page.produits;
  } catch (e) {
    // Les signaux internes de Next.js (rendu dynamique, redirection) doivent remonter ; toute autre erreur masque le bloc.
    unstable_rethrow(e);
    console.error("[accueil] lecture des kits impossible :", e instanceof Error ? `${e.name} ${e.message}` : "erreur inconnue");
    return [];
  }
}
