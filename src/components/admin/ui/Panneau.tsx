import { useId, type ReactNode } from "react";

// Classes partagées (story 9.16, étape 8) : les sections existantes qui rendent leur propre <section> (tâches, réglages…) prennent l'apparence du
// panneau sans changer de structure. Carte = élément d'une liste dans un panneau (fond « en-tête », coins de 16 px, comme les cartes des codes promo).
export const CLASSES_PANNEAU = "rounded-[22px] border border-admin-contour bg-admin-panneau p-5 text-text-primary";
export const CLASSES_TITRE_PANNEAU = "t-label text-[18px] leading-6 uppercase";
export const CLASSES_CARTE_ADMIN = "rounded-[16px] bg-admin-entete p-4 text-text-primary";

// Grand panneau de l'admin (story 9.16 b, maquettes B3, C5, CB2, E5) : surface arrondie qui regroupe une liste, un graphique ou un formulaire.
// titre facultatif (titre de section, niveau choisi par la page ; il nomme la section pour les lecteurs d'écran) et « action » à droite du titre
// (bouton, compteur, filtres).
export function Panneau({
  titre,
  niveau = 2,
  action,
  children,
  className = "",
}: {
  titre?: ReactNode;
  niveau?: 2 | 3;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const idTitre = useId();
  const Titre = niveau === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={titre ? idTitre : undefined} className={`${CLASSES_PANNEAU} ${className}`}>
      {titre || action ? (
        <div className={`mb-4 flex flex-wrap items-center gap-3 ${titre ? "justify-between" : "justify-end"}`}>
          {titre ? (
            <Titre id={idTitre} className="t-label text-[18px] leading-6">
              {titre}
            </Titre>
          ) : null}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
