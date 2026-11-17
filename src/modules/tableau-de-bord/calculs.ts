// Calculs purs du tableau de bord (story 9.8) : aucune lecture, aucun accès réseau. Les entrées viennent des fonctions
// d'agrégats (partie 1) et des vues de la story 9.7 ; aucune ne porte de donnée personnelle.
export type LignePaiement = { jour: string; prestataire: string; famille: string; commandes: number; montant_cents: number };
export type Total = { cle: string; montantCents: number };
export type PointJour = { jour: string; montantCents: number };

// Total par clé (Prestataire ou Famille) sur les jours demandés, du plus gros au plus petit.
export function totalPar(lignes: readonly LignePaiement[], cle: "prestataire" | "famille", jours: ReadonlySet<string>): Total[] {
  const sommes = new Map<string, number>();
  for (const l of lignes) {
    if (!jours.has(l.jour)) continue;
    sommes.set(l[cle], (sommes.get(l[cle]) ?? 0) + Number(l.montant_cents));
  }
  return [...sommes.entries()]
    .map(([k, montantCents]) => ({ cle: k, montantCents }))
    .sort((a, b) => b.montantCents - a.montantCents || a.cle.localeCompare(b.cle));
}

// Un point par jour de la fenêtre, y compris les jours sans paiement (zéro réel : aucun paiement vérifié ce jour-là).
export function serieParJour(lignes: readonly LignePaiement[], jours: readonly string[]): PointJour[] {
  const sommes = new Map<string, number>(jours.map((j) => [j, 0]));
  for (const l of lignes) {
    if (sommes.has(l.jour)) sommes.set(l.jour, (sommes.get(l.jour) ?? 0) + Number(l.montant_cents));
  }
  return jours.map((jour) => ({ jour, montantCents: sommes.get(jour) ?? 0 }));
}

export function sommeMontants(lignes: readonly LignePaiement[], jours: ReadonlySet<string>): number {
  let s = 0;
  for (const l of lignes) if (jours.has(l.jour)) s += Number(l.montant_cents);
  return s;
}

// Nombre de Commandes par Famille : jamais additionné entre Familles (une Commande mixte compte dans chacune).
export function commandesParFamille(lignes: readonly LignePaiement[], jours: ReadonlySet<string>): Record<string, number> {
  const r: Record<string, number> = {};
  for (const l of lignes) if (jours.has(l.jour)) r[l.famille] = (r[l.famille] ?? 0) + l.commandes;
  return r;
}

// Part en pourcentage, arrondie à l'unité ; null quand le dénominateur est nul (jamais un pourcentage inventé).
export function pourcentage(numerateur: number, denominateur: number): number | null {
  if (!(denominateur > 0)) return null;
  return Math.round((numerateur / denominateur) * 100);
}

// Somme d'une colonne d'une vue par jour, sur les jours demandés, filtrée au besoin.
export function sommeVue<T extends { jour: string | null }>(
  lignes: readonly T[],
  valeur: (l: T) => number | null,
  jours: ReadonlySet<string>,
  garder: (l: T) => boolean = () => true,
): number {
  let s = 0;
  for (const l of lignes) if (l.jour && jours.has(l.jour) && garder(l)) s += valeur(l) ?? 0;
  return s;
}

export type LigneEchec = {
  prestataire: string;
  moyen: string;
  tentatives: number;
  reussies: number;
  echouees_client: number;
  echouees_prestataire: number;
  abandonnees: number;
  en_cours: number;
};

// SM-C2 : échecs imputables au Prestataire / tentatives terminées (en_cours exclu). null si aucune tentative terminée.
export function tauxEchecPrestataire(l: Pick<LigneEchec, "reussies" | "echouees_client" | "echouees_prestataire" | "abandonnees">): number | null {
  return pourcentage(l.echouees_prestataire, l.reussies + l.echouees_client + l.echouees_prestataire + l.abandonnees);
}

// Regroupe les lignes (Prestataire, moyen) par Prestataire.
export function echecsParPrestataire(lignes: readonly LigneEchec[]): { prestataire: string; terminees: number; echouees: number; taux: number | null }[] {
  const m = new Map<string, LigneEchec>();
  for (const l of lignes) {
    const a = m.get(l.prestataire) ?? { ...l, moyen: "", tentatives: 0, reussies: 0, echouees_client: 0, echouees_prestataire: 0, abandonnees: 0, en_cours: 0 };
    a.reussies += l.reussies;
    a.echouees_client += l.echouees_client;
    a.echouees_prestataire += l.echouees_prestataire;
    a.abandonnees += l.abandonnees;
    m.set(l.prestataire, a);
  }
  return [...m.values()]
    .map((a) => ({
      prestataire: a.prestataire,
      terminees: a.reussies + a.echouees_client + a.echouees_prestataire + a.abandonnees,
      echouees: a.echouees_prestataire,
      taux: tauxEchecPrestataire(a),
    }))
    .sort((x, y) => x.prestataire.localeCompare(y.prestataire));
}

// Montant en centimes USD -> texte dans la langue de l'écran ; seul l'USD est affiché (CLAUDE.md, « Prix et livraison »).
export function formaterUsd(centimes: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(centimes / 100);
}

// Graduations de l'axe des montants (story 9.16 c) : de 0 à une borne ronde au moins égale au maximum, 4 à 6 intervalles d'un pas
// « rond » (1, 2 ou 5 × une puissance de 10), jamais moins d'un dollar. Sans montant (tout à zéro), l'axe va de 0 à 5 $ : c'est une échelle,
// pas une donnée (les barres restent à zéro).
export function graduations(maxCents: number): number[] {
  const max = Number.isFinite(maxCents) && maxCents > 0 ? maxCents : 0;
  const brut = Math.max(100, max / 5);
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const normalise = brut / puissance;
  const pas = (normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 5 ? 5 : 10) * puissance;
  const haut = max === 0 ? 5 * pas : Math.ceil(max / pas) * pas;
  const valeurs: number[] = [];
  for (let v = 0; v <= haut + pas / 2; v += pas) valeurs.push(Math.round(v));
  return valeurs;
}

// Indices des barres dont la date est écrite sous l'axe : une tous les `pas` jours, en partant du dernier jour (aujourd'hui toujours daté).
export function indicesDates(nombre: number, pas = 5): number[] {
  const indices: number[] = [];
  for (let i = nombre - 1; i >= 0; i -= pas) indices.unshift(i);
  return indices;
}

// Ventes du jour (Performance du jour) : nombre et montant des Commandes payées lues ; `auMoins` quand la lecture a atteint son plafond
// (les chiffres sont alors des minimums, jamais présentés comme exacts).
export function ventesDuJour(commandes: readonly { totalCents: number }[], plafond: number): { nombre: number; montantCents: number; auMoins: boolean } {
  return { nombre: commandes.length, montantCents: commandes.reduce((s, c) => s + c.totalCents, 0), auMoins: commandes.length >= plafond };
}

// Montant compact pour l'axe (« 70 k $US », « $70K » selon la langue).
export function formaterUsdCompact(centimes: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(centimes / 100);
}

// Plafond de tableau_commandes_payees (limit 200 dans la fonction SQL).
export const PLAFOND_COMMANDES_PAYEES = 200;

// Taux de paiements réussis (carte « Paiements réussis ») : arrondi à l'inférieur, pour ne jamais afficher 100 % quand une tentative a échoué
// ou a été abandonnée. null quand aucune tentative n'est terminée (jamais un pourcentage inventé).
export function tauxReussite(reussies: number, terminees: number): number | null {
  if (!(terminees > 0)) return null;
  return Math.floor((reussies / terminees) * 100);
}

// Au-delà de ce revenu (1 000 USD), le montant est écrit plus petit pour rester dans la carte (jamais arrondi ni abrégé).
export const SEUIL_REVENU_PETIT_CENTS = 100_000;

export type CleChiffre = "produitsPublies" | "commandesTotal" | "revenuTotal" | "paiementsReussis";
export type CarteChiffreDonnee = { cle: CleChiffre; chiffre: string; texte: boolean };

// Les 4 cartes de chiffres du tableau de bord (maquette E1 à E4), dans l'ordre de la maquette. Les textes viennent de la page (traductions).
export function cartesChiffres(
  c: { produitsPublies: number; commandesPayees: number; revenuCents: number; tentativesReussies: number; tentativesTerminees: number },
  textes: { usd: (centimes: number) => string; taux: (taux: number) => string; aucuneDonnee: string },
): CarteChiffreDonnee[] {
  const taux = tauxReussite(c.tentativesReussies, c.tentativesTerminees);
  return [
    { cle: "produitsPublies", chiffre: String(c.produitsPublies), texte: false },
    { cle: "commandesTotal", chiffre: String(c.commandesPayees), texte: false },
    { cle: "revenuTotal", chiffre: textes.usd(c.revenuCents), texte: c.revenuCents >= SEUIL_REVENU_PETIT_CENTS },
    { cle: "paiementsReussis", chiffre: taux === null ? textes.aucuneDonnee : textes.taux(taux), texte: taux === null },
  ];
}
