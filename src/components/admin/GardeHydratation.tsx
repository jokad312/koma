"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// Point 5 de Jonathan (2026-11-21) : tant que React n'a pas pris la main (hydratation), les formulaires de l'admin ne doivent rien accepter, sinon
// une saisie faite trop tôt reste dans le champ mais pas dans l'état React (formulaires contrôlés : perdue à l'envoi ; vu en CI le 2026-11-17).
// Un <fieldset disabled> désactive nativement, sans JavaScript, tous les champs et boutons qu'il contient ; il est levé à l'hydratation.
// « contents » : le fieldset ne crée aucune boîte, la mise en page ne change pas. Les liens restent actifs (navigation possible avant).
const sAbonner = () => () => {};

export function GardeHydratation({ children }: { children: ReactNode }) {
  // Faux pendant le rendu serveur et l'hydratation, vrai ensuite (aucun effet de bord, aucune double mise en page).
  const pret = useSyncExternalStore(
    sAbonner,
    () => true,
    () => false,
  );
  return (
    <fieldset disabled={!pret} data-admin-pret={pret ? "" : undefined} className="contents m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  );
}
