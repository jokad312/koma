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
