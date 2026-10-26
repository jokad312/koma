import { useTranslations } from "next-intl";
import type { Disponibilite } from "@/modules/catalogue/types";

// Une forme d'icône par état : l'état n'est jamais porté par la couleur seule. Jamais de quantité ni de compteur.
// « Épuisé » ne s'affiche que sans stock et sans fabrication possible ; le Plafond de fabrication atteint dit « Commandes complètes ».
const ICONES: Record<Disponibilite, string> = {
  disponible: "M5 12.5l4.5 4.5L19 7.5",
  dernieres_pieces: "M12 4v9M12 17.5v.5",
  sur_commande: "M12 4v8l5 3M12 3a9 9 0 100 18 9 9 0 000-18z",
  complet: "M5 12h14M12 5v14",
  epuise: "M6 6l12 12M18 6L6 18",
};

const COULEURS: Record<Disponibilite, string> = {
  disponible: "text-success",
  dernieres_pieces: "text-warning",
  sur_commande: "text-text-primary",
  complet: "text-warning",
  epuise: "text-text-secondary",
};

export function BadgeDisponibilite({ etat }: { etat: Disponibilite }) {
  const t = useTranslations("Catalogue.disponibilite");
  return (
    <p className="t-small flex items-center gap-2 text-text-primary">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`size-4 shrink-0 fill-none stroke-current stroke-2 ${COULEURS[etat]}`}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={ICONES[etat]} />
      </svg>
      <span>{t(etat)}</span>
    </p>
  );
}
