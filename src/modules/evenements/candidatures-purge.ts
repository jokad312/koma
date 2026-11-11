// Purge des candidatures Stand (story 7.11, AD-37) : photos (bucket privé) et lien Instagram supprimés 90 jours après la fin de l'Événement, ou 90 jours
// après un refus ou une expiration sans paiement. La base désigne les candidatures (candidatures_stand_a_purger) ; le serveur efface d'abord les objets,
// puis demande à la base de marquer la candidature purgée. Une erreur d'effacement ne marque rien : la candidature revient au passage suivant.
export type DependancesPurgeCandidatures = {
  aPurger(limite: number): Promise<{ erreur: string | null; candidatures: { id: string; photos: string[] }[] }>;
  effacerObjets(objets: string[]): Promise<{ erreur: string | null }>;
  marquerPurgee(id: string): Promise<{ erreur: string | null }>;
  // Envois directs jamais finalisés (dossier envois-candidatures/) : nom complet de l'objet et date de création.
  listerEnvois(): Promise<{ erreur: string | null; objets: { objet: string; creeLe: string | null }[] }>;
};

// Un envoi non finalisé au bout de 3 h est abandonné : son original est effacé. Le jeton d'envoi signé expire avant (environ 2 h), donc plus personne
// ne peut redéposer un fichier à ce chemin après l'effacement.
export const DELAI_ENVOI_ABANDONNE_MS = 3 * 60 * 60 * 1000;

export type ResultatPurgeCandidatures = { ok: boolean; purgees: number; echecs: number; envoisEfface: number };

// Lot borné (50) : le reste part au passage suivant. Jamais de nom d'objet ni d'identifiant journalisé.
export async function purgerCandidaturesStand(deps: DependancesPurgeCandidatures, limite = 50, maintenant: number = Date.now()): Promise<ResultatPurgeCandidatures> {
  const lot = await deps.aPurger(limite);
  if (lot.erreur) {
    console.error("[purge-candidatures-stand] lecture du lot impossible");
    return { ok: false, purgees: 0, echecs: 1, envoisEfface: 0 };
  }
  let purgees = 0;
  let echecs = 0;
  for (const c of lot.candidatures) {
    try {
      if (c.photos.length > 0) {
        const efface = await deps.effacerObjets(c.photos);
        if (efface.erreur) {
          echecs += 1;
          continue;
        }
      }
      const marque = await deps.marquerPurgee(c.id);
      if (marque.erreur) {
        echecs += 1;
        continue;
      }
      purgees += 1;
    } catch {
      echecs += 1;
    }
  }
  // Originaux d'envois abandonnés : seuls ceux de plus de 24 h, jamais un envoi en cours.
  let envoisEfface = 0;
  try {
    const envois = await deps.listerEnvois();
    if (envois.erreur) {
      echecs += 1;
    } else {
      const vieux = envois.objets.filter((o) => o.creeLe !== null && maintenant - Date.parse(o.creeLe) > DELAI_ENVOI_ABANDONNE_MS).map((o) => o.objet);
      if (vieux.length > 0) {
        const efface = await deps.effacerObjets(vieux);
        if (efface.erreur) echecs += 1;
        else envoisEfface = vieux.length;
      }
    }
  } catch {
    echecs += 1;
  }
  return { ok: echecs === 0, purgees, echecs, envoisEfface };
}
