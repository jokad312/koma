// Rubriques de navigation. Une rubrique dont la page n'existe pas n'est pas affichée :
// chaque story qui crée une page (Cosplays, Accessoires, Kits, Festival, Blog, À propos) ajoute sa ligne ici.
// Les libellés sont dans messages/*.json › Navigation.rubriques.<cle>.
export type Rubrique = { cle: "cosplays" | "accessoires" | "kits" | "festival" | "blog" | "aPropos"; href: string };

// href : chemin interne ; l'adresse de la langue courante est calculée à l'affichage (src/i18n/adresses.ts).
export const RUBRIQUES: readonly Rubrique[] = [
  { cle: "cosplays", href: "/cosplays" },
  { cle: "accessoires", href: "/accessoires" },
  { cle: "aPropos", href: "/a-propos" },
];
