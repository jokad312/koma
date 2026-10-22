import type { ReactNode } from "react";
import { NavigationAdmin } from "./NavigationAdmin";

// Coquille de l'admin : ni Sakura Town ni motif manga. Rendue par chaque page seulement après la vérification du droit
// (le visiteur ou le Compte sans droit ne voit jamais la navigation). L'en-tête et le pied du site restent autour.
export function CoqueAdmin({ children }: { children: ReactNode }) {
  return (
    <div className="md:flex md:items-start md:gap-8">
      <NavigationAdmin />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
