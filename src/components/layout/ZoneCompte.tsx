import { lireSessionVerifiee } from "@/lib/auth/compte";
import { BoutonDeconnexion } from "./BoutonDeconnexion";
import { LienConnexion } from "./LienConnexion";

// Lit la session : à rendre sous <Suspense> (cacheComponents), le reste de l'en-tête reste statique.
// Repli et visiteur sans session : « Se connecter ».
export async function ZoneCompte() {
  let connecte = false;
  try {
    connecte = (await lireSessionVerifiee()) !== null;
  } catch {
    // Supabase indisponible : l'en-tête reste utilisable comme pour un visiteur.
  }
  return connecte ? <BoutonDeconnexion /> : <LienConnexion />;
}
