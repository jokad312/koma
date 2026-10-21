import { headers } from "next/headers";
import { detecterNavigateurIntegre } from "@/lib/navigateur-integre";
import { BandeauNavigateurIntegreClient } from "./BandeauNavigateurIntegreClient";

// Lit l'agent utilisateur (donnée de requête) : à rendre sous <Suspense> (cacheComponents). Rien en dehors d'un navigateur intégré.
export async function BandeauNavigateurIntegre() {
  const detection = detecterNavigateurIntegre((await headers()).get("user-agent"));
  if (!detection.integre) return null;
  return <BandeauNavigateurIntegreClient plateforme={detection.plateforme} />;
}
