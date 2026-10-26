// Purge de galerie-attente : les envois abandonnés (onglet fermé, coupure) laissent des originaux dans le bucket privé.
// Pur et testable : le stockage est injecté (en test, un faux nommé TEST_).

// Âge à partir duquel un original d'attente est considéré comme abandonné.
export const AGE_MAX_ATTENTE_MS = 24 * 60 * 60 * 1000;

// Taille d'un lot d'effacement.
const LOT = 100;

// Disposition de galerie-attente : deux niveaux, <produit>/<uuid>.<ext> (dossier du produit, puis fichier). `creeLe` est l'âge de
// référence : la dernière modification si elle existe, sinon la création (un fichier en cours de finalisation n'est pas supprimé).
export type EntreeAttente = { name: string; creeLe: string | null; estDossier: boolean };

export type StockageAttente = {
  // Entrées d'un dossier du bucket ("" = racine), toutes pages comprises.
  lister(dossier: string): Promise<{ erreur: string | null; entrees: EntreeAttente[] }>;
  // Renvoie le nombre d'objets réellement effacés (selon la réponse du stockage).
  supprimer(objets: string[]): Promise<{ erreur: string | null; effaces: number }>;
};

export type ResultatPurge = { ok: true; effaces: number; echecs: number } | { ok: false };

// Efface les objets de plus de AGE_MAX_ATTENTE_MS. Un objet sans date lisible n'est jamais effacé. Ne renvoie que des nombres.
export async function purgerGalerieAttente(stockage: StockageAttente, maintenant: number): Promise<ResultatPurge> {
  const limite = maintenant - AGE_MAX_ATTENTE_MS;
  const racine = await stockage.lister("");
  if (racine.erreur) return { ok: false };

  const anciens: string[] = [];
  let echecs = 0;
  for (const dossier of racine.entrees.filter((e) => e.estDossier)) {
    const contenu = await stockage.lister(dossier.name);
    if (contenu.erreur) {
      echecs += 1;
      continue;
    }
    for (const fichier of contenu.entrees) {
      if (fichier.estDossier || !fichier.creeLe) continue;
      const date = Date.parse(fichier.creeLe);
      if (Number.isFinite(date) && date < limite) anciens.push(`${dossier.name}/${fichier.name}`);
    }
  }
  // Fichiers posés directement à la racine (non prévus par l'application) : même règle.
  for (const fichier of racine.entrees) {
    if (fichier.estDossier || !fichier.creeLe) continue;
    const date = Date.parse(fichier.creeLe);
    if (Number.isFinite(date) && date < limite) anciens.push(fichier.name);
  }

  let effaces = 0;
  for (let i = 0; i < anciens.length; i += LOT) {
    const lot = anciens.slice(i, i + LOT);
    const { erreur, effaces: n } = await stockage.supprimer(lot);
    if (erreur) echecs += lot.length;
    else {
      effaces += n;
      echecs += lot.length - n;
    }
  }
  return { ok: true, effaces, echecs };
}
