import "server-only";
import { dependances } from "./dependances";
import { fusionner } from "./service";

// Appelé par le module comptes après une connexion réussie (code email ou Google). Ne lève jamais.
export async function fusionnerPanierApresConnexion(compteId: string): Promise<void> {
  await fusionner(dependances(), compteId);
}
