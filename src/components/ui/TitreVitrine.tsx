import { lireEnvPublique } from "@/lib/env";
import { choisirPoliceTitre, preparerTitre } from "@/lib/typo/titre";

const ROLES = { h1: "t-h1", h2: "t-h2", display: "t-display" } as const;

type Props = {
  // 3 : titre de bloc sous un H2 de page (espace personnel, « Découvrir la boutique ») ; même rôle typographique que le niveau 2.
  niveau: 1 | 2 | 3;
  // Rôle typographique de repli (Barlow Condensed) quand Sakura Town est éteinte ou ne couvre pas tout le titre.
  role?: keyof typeof ROLES;
  // Titre saisi en base (produit, article, événement) : jamais réécrit, donc jamais sans accents ; Sakura ne le couvre que s'il est déjà compatible.
  donnee?: boolean;
  children: string;
};

// Grand titre de vitrine : le choix de police se fait au rendu côté serveur, sur le titre ENTIER.
// Jamais sur un lien, un bouton, un prix, une étiquette ni dans un écran transactionnel ou l'admin.
export function TitreVitrine({ niveau, role = niveau === 1 ? "h1" : "h2", donnee = false, children }: Props) {
  const sakura = lireEnvPublique().NEXT_PUBLIC_TITRES_SAKURA;
  const { texte, police } = donnee ? { texte: children, police: choisirPoliceTitre(children, sakura) } : preparerTitre(children, sakura);
  const Balise = niveau === 1 ? "h1" : niveau === 2 ? "h2" : "h3";
  return (
    <Balise data-police={police} className={police === "sakura" ? "titre-vitrine" : `titre-vitrine ${ROLES[role]}`}>
      {texte}
    </Balise>
  );
}
