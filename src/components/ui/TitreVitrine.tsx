import { lireEnvPublique } from "@/lib/env";
import { choisirPoliceTitre } from "@/lib/typo/titre";

const ROLES = { h1: "t-h1", h2: "t-h2", display: "t-display" } as const;

type Props = {
  niveau: 1 | 2;
  // Rôle typographique de repli (Barlow Condensed) quand Sakura Town est éteinte ou ne couvre pas tout le titre.
  role?: keyof typeof ROLES;
  children: string;
};

// Grand titre de vitrine : le choix de police se fait au rendu côté serveur, sur le titre ENTIER.
// Jamais sur un lien, un bouton, un prix, une étiquette ni dans un écran transactionnel ou l'admin.
export function TitreVitrine({ niveau, role = niveau === 1 ? "h1" : "h2", children }: Props) {
  const police = choisirPoliceTitre(children, lireEnvPublique().NEXT_PUBLIC_TITRES_SAKURA);
  const Balise = niveau === 1 ? "h1" : "h2";
  return (
    <Balise data-police={police} className={police === "sakura" ? "titre-vitrine" : `titre-vitrine ${ROLES[role]}`}>
      {children}
    </Balise>
  );
}
