import type { BilanLot, DependancesEnvois } from "./types";

export const TAILLE_LOT = 10;

// Traite un lot borné. Un envoi n'est « envoyé » que si le prestataire renvoie un identifiant (règle 13) ;
// toute exception ou tout refus devient un échec (nouvel essai plus tard, puis abandon et anomalie, côté base).
// Aucune adresse ni aucun contenu dans les messages d'erreur gardés.
export async function traiterLot(deps: DependancesEnvois, limite: number = TAILLE_LOT): Promise<BilanLot> {
  const bilan: BilanLot = { reserves: 0, envoyes: 0, ignores: 0, reessais: 0, erreurBase: false };
  const lot = await deps.reserverLot(limite);
  if (lot.erreur) return { ...bilan, erreurBase: true };
  bilan.reserves = lot.envois.length;

  for (const envoi of lot.envois) {
    try {
      const rendu = await deps.rendre(envoi);
      if (rendu.statut === "ignorer") {
        const r = await deps.ignorer(envoi.id, rendu.raison);
        if (r.erreur) bilan.erreurBase = true;
        else bilan.ignores += 1;
        continue;
      }
      if (rendu.statut === "reessayer") {
        const r = await deps.marquerEchec(envoi.id, rendu.raison);
        if (r.erreur) bilan.erreurBase = true;
        bilan.reessais += 1;
        continue;
      }
      const envoye = await deps.envoyer({ envoiId: envoi.id, destinataire: rendu.destinataire, message: rendu.message });
      if (envoye.erreur !== null || !envoye.idPrestataire) {
        const r = await deps.marquerEchec(envoi.id, envoye.erreur ?? "identifiant du prestataire absent");
        if (r.erreur) bilan.erreurBase = true;
        bilan.reessais += 1;
        continue;
      }
      const r = await deps.marquerEnvoye(envoi.id, envoye.idPrestataire);
      if (r.erreur) bilan.erreurBase = true;
      else bilan.envoyes += 1;
    } catch {
      try {
        await deps.marquerEchec(envoi.id, "exception pendant le traitement");
      } catch {
        bilan.erreurBase = true;
      }
      bilan.reessais += 1;
    }
  }
  return bilan;
}
