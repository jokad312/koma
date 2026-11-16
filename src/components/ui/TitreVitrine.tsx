const ROLES = { h1: "t-h1", h2: "t-h2", display: "t-display" } as const;

type Props = {
  // 3 : titre de bloc sous un H2 de page (espace personnel, « Découvrir la boutique ») ; même rôle typographique que le niveau 2.
  niveau: 1 | 2 | 3;
  // Rôle typographique (KOMA Chikara, police unique depuis 9.16 a).
  role?: keyof typeof ROLES;
  // Titre saisi en base (produit, article, événement) : rendu tel quel, avec ses accents. Gardé pour l'API des appelants.
  donnee?: boolean;
  children: string;
};

// Grand titre de vitrine : rôle typographique t-* appliqué tel quel, accents compris (KOMA Chikara les dessine).
// Jamais sur un lien, un bouton, un prix, une étiquette ni dans un écran transactionnel ou l'admin.
export function TitreVitrine({ niveau, role = niveau === 1 ? "h1" : "h2", children }: Props) {
  const Balise = niveau === 1 ? "h1" : niveau === 2 ? "h2" : "h3";
  return <Balise className={`titre-vitrine ${ROLES[role]}`}>{children}</Balise>;
}
