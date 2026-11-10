// Seul fichier qui produit les étiquettes de cache (AD-17).
export const ETIQUETTES = {
  reglages: "reglages",
  catalogue: "catalogue",
  articles: "articles",
  // Événements et Types de pass (epic 7) : invalidé à chaque écriture ou publication.
  evenements: "evenements",
  prestataires: "prestataires",
  // Mur « Ils le portent » (stories 8.2 et 8.3) : invalidé à chaque publication ou retrait d'une photo.
  galerie: "galerie",
} as const;
