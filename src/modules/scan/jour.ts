// Début du jour (minuit) à Goma, fuseau Africa/Lubumbashi (UTC+2, sans changement d'heure) : un Événement se scanne jusqu'à la fin de son jour.
const DECALAGE_MS = 2 * 60 * 60 * 1000;
const JOUR_MS = 24 * 60 * 60 * 1000;

export function debutDuJourLubumbashi(maintenant: Date): Date {
  const local = maintenant.getTime() + DECALAGE_MS;
  return new Date(Math.floor(local / JOUR_MS) * JOUR_MS - DECALAGE_MS);
}
