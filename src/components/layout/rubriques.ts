// Rubriques de navigation. Une rubrique dont la page n'existe pas n'est pas affichée :
// chaque story qui crée une page (Cosplays, Accessoires, Kits, Festival, Blog, À propos) ajoute sa ligne ici.
// Les libellés sont dans messages/*.json › Navigation.rubriques.<cle>.
export type Rubrique = {
  cle: "cosplays" | "accessoires" | "vetements" | "autresArticles" | "kits" | "festival" | "blog" | "aPropos";
  href: string;
};

// href : chemin interne ; l'adresse de la langue courante est calculée à l'affichage (src/i18n/adresses.ts).
// Story 9.15, option C (décision 1 de Jonathan) : les cinq catalogues sont regroupés sous une seule entrée « Boutique » de l'en-tête
// (bouton + panneau de liens) ; sur mobile, ils restent listés dans le panneau ☰ sous le titre « Boutique ».
export const RUBRIQUES_BOUTIQUE: readonly Rubrique[] = [
  { cle: "cosplays", href: "/cosplays" },
  { cle: "accessoires", href: "/accessoires" },
  { cle: "vetements", href: "/vetements" },
  { cle: "autresArticles", href: "/autres-articles" },
  { cle: "kits", href: "/kits" },
];

// Liens directs de l'en-tête, après « Boutique ».
export const RUBRIQUES_DIRECTES: readonly Rubrique[] = [
  { cle: "festival", href: "/festival" },
  { cle: "blog", href: "/blog" },
  { cle: "aPropos", href: "/a-propos" },
];

export const RUBRIQUES: readonly Rubrique[] = [...RUBRIQUES_BOUTIQUE, ...RUBRIQUES_DIRECTES];
