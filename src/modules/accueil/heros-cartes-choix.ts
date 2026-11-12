import type { CarteProduit } from "@/modules/catalogue/types";

export type CartesHeros = {
  cosplay: CarteProduit | null;
  accessoire: CarteProduit | null;
  kit: CarteProduit | null;
};

// Choix des trois cartes à partir de listes déjà triées « nouveautés » (la plus récente d'abord) et déjà limitées aux produits publiés.
// - cosplay : le plus récent qui n'est pas la vedette (déjà en grand à droite) ; à défaut la vedette elle-même ;
// - accessoire : le plus récent ;
// - kit : le Kit publié le plus récent (aucun champ « Kit du mois » n'existe en base : hors périmètre).
// Une famille sans produit publié donne null : la carte est masquée.
export function choisirCartesHeros(entree: {
  cosplays: CarteProduit[];
  accessoires: CarteProduit[];
  kits: CarteProduit[];
  slugVedette: string | null;
}): CartesHeros {
  const autre = entree.cosplays.find((c) => c.slug !== entree.slugVedette);
  return {
    cosplay: autre ?? entree.cosplays[0] ?? null,
    accessoire: entree.accessoires[0] ?? null,
    kit: entree.kits[0] ?? null,
  };
}
