import type { ReactNode } from "react";

// Grand panneau de l'admin (story 9.16 b, maquettes B3, C5, CB2, E5) : surface arrondie qui regroupe une liste, un graphique ou un formulaire.
// titre facultatif (titre de section, niveau choisi par la page) et « action » à droite du titre (bouton, compteur, filtres).
export function Panneau({
  titre,
  niveau = 2,
  action,
  children,
  className = "",
}: {
  titre?: string;
  niveau?: 2 | 3;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const Titre = niveau === 2 ? "h2" : "h3";
  return (
    <section className={`rounded-[22px] border border-admin-contour bg-admin-panneau p-5 text-text-primary ${className}`}>
      {titre || action ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {titre ? <Titre className="t-label text-[18px] leading-6">{titre}</Titre> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
