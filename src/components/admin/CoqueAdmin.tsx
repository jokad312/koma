import type { ReactNode } from "react";
import { compterMessagesNouveaux } from "@/modules/admin/queries";
import { NavigationAdmin } from "./NavigationAdmin";

// Coquille de l'admin : ni Sakura Town ni motif manga. Rendue par chaque page seulement après la vérification du droit
// (le visiteur ou le Compte sans droit ne voit jamais la navigation). L'en-tête et le pied du site restent autour.
// Le compteur de messages à traiter est lu par le client service ; en cas d'erreur, pas de compteur (jamais un faux zéro).
export async function CoqueAdmin({ children }: { children: ReactNode }) {
  const compteurMessages = await compterMessagesNouveaux();
  return (
    <div className="md:flex md:items-start md:gap-8">
      <NavigationAdmin compteurMessages={compteurMessages} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
