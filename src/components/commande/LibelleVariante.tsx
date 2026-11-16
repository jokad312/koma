import { useTranslations } from "next-intl";

type Props = {
  // Textes du Panier ou du Récapitulatif (mêmes clés : taille, tailleSurMesure, tailleUnique, avecCouleur).
  espace: "Panier" | "Commande.recap";
  taille: string | null;
  // Couleur d'une variante de Vêtement, déjà dans la langue de la page ; null sinon.
  couleur?: string | null;
};

// Libellé d'une ligne physique : « Taille : M », « Taille : sur mesure », « Taille unique », avec la couleur : « Taille : M · Noir ».
export function LibelleVariante({ espace, taille, couleur }: Props) {
  const t = useTranslations(espace);
  const base = taille === "sur_mesure" ? t("tailleSurMesure") : taille === "unique" ? t("tailleUnique") : t("taille", { taille: taille ?? "" });
  return <>{couleur ? t("avecCouleur", { variante: base, couleur }) : base}</>;
}
