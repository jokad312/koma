// Rubriques de navigation. Une rubrique dont la page n'existe pas n'est pas affichée :
// chaque story qui crée une page (Cosplays, Accessoires, Kits, Festival, Blog, À propos) ajoute sa ligne ici.
// Les libellés sont dans messages/*.json › Navigation.rubriques.<cle>.
export type Rubrique = { cle: "cosplays" | "accessoires" | "kits" | "festival" | "blog" | "aPropos"; href: string };

export const RUBRIQUES: readonly Rubrique[] = [];
