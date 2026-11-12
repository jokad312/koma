// Entrées de la navigation de l'admin (story 9.10) : groupes avec titre, seulement les pages qui existent (chaque story qui crée une page admin ajoute sa ligne ici).
// « adminSeulement » : l'entrée n'est montrée qu'à l'Admin (la page refuse de toute façon l'Assistant, droit « roles.gerer »).
export type EntreeNavigation = { cle: string; href: string; adminSeulement?: boolean };
export type GroupeNavigation = { cle: "navigation" | "communaute" | "reglages"; entrees: readonly EntreeNavigation[] };

export const GROUPES: readonly GroupeNavigation[] = [
  {
    cle: "navigation",
    entrees: [
      { cle: "tableau", href: "/admin" },
      { cle: "commandes", href: "/admin/commandes" },
      { cle: "taches", href: "/admin/taches" },
      { cle: "produits", href: "/admin/produits" },
      { cle: "univers", href: "/admin/univers" },
      { cle: "utilisateurs", href: "/admin/utilisateurs", adminSeulement: true },
    ],
  },
  {
    cle: "communaute",
    entrees: [
      { cle: "evenements", href: "/admin/evenements" },
      // Écran de Scan (story 7.6) : hors du dossier /admin (plein écran sur téléphone), mais réservé à l'administration.
      { cle: "scan", href: "/scan" },
      { cle: "galerie", href: "/admin/galerie" },
      { cle: "blog", href: "/admin/blog" },
      { cle: "messages", href: "/admin/messages" },
    ],
  },
  {
    cle: "reglages",
    entrees: [
      { cle: "codesPromo", href: "/admin/codes-promo" },
      { cle: "prestataires", href: "/admin/prestataires" },
      { cle: "reglages", href: "/admin/reglages" },
    ],
  },
];

// Sur mobile, la barre du bas garde les entrées de tous les jours (UX-DR42) ; le reste passe par le bouton ☰ « Plus ».
export const PRINCIPALES: readonly string[] = ["tableau", "commandes", "taches"];

// « /admin » est le tableau de bord : il n'est courant que sur sa propre page, jamais sur les sous-pages.
export function estCourante(chemin: string, href: string): boolean {
  return href === "/admin" ? chemin === href : chemin === href || chemin.startsWith(`${href}/`);
}

export function entreesVisibles(estAdmin: boolean): readonly GroupeNavigation[] {
  return GROUPES.map((g) => ({ ...g, entrees: g.entrees.filter((e) => !e.adminSeulement || estAdmin) }));
}
