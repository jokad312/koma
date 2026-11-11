// Charge du Code QR d'un Pass (story 7.5), lue par l'écran de Scan (story 7.6). Fichier sans dépendance : il est chargé dans le navigateur.
export const PREFIXE_CHARGE_QR = "KOMA:PASS:";

const MOTIF_JETON = /^[0-9a-f]{48}$/;
const MOTIF_JETON_SAISI = /^[0-9a-fA-F]{48}$/;

export function jetonValide(jeton: string): boolean {
  return MOTIF_JETON.test(jeton);
}

// Lit le jeton d'une charge de Code QR ; null si ce n'est pas un Pass KOMA bien formé (aucun autre contenu n'est jamais envoyé au serveur).
export function extraireJeton(charge: string): string | null {
  const texte = charge.trim();
  if (!texte.startsWith(PREFIXE_CHARGE_QR)) return null;
  const jeton = texte.slice(PREFIXE_CHARGE_QR.length);
  // Les majuscules sont acceptées (comme la base) et ramenées en minuscules avant tout envoi.
  return MOTIF_JETON_SAISI.test(jeton) ? jeton.toLowerCase() : null;
}
