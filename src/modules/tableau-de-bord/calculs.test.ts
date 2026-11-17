import { describe, expect, it } from "vitest";
import {
  cartesChiffres,
  commandesParFamille,
  echecsParPrestataire,
  formaterUsd,
  formaterUsdCompact,
  graduations,
  indicesDates,
  pourcentage,
  serieParJour,
  sommeMontants,
  sommeVue,
  tauxReussite,
  totalPar,
  ventesDuJour,
  type LignePaiement,
} from "./calculs";
import { jourGoma, joursFenetre, lirePeriode, minuitGoma } from "./periode";

// Données de test, nommées TEST_ : jamais utilisées hors des tests.
const TEST_LIGNES: LignePaiement[] = [
  { jour: "2026-11-08", prestataire: "pawapay", famille: "cosplay", commandes: 1, montant_cents: 12000 },
  { jour: "2026-11-08", prestataire: "pawapay", famille: "livraison", commandes: 1, montant_cents: 500 },
  { jour: "2026-11-10", prestataire: "maishapay", famille: "kit", commandes: 2, montant_cents: 3000 },
  { jour: "2026-10-01", prestataire: "polar", famille: "kit", commandes: 1, montant_cents: 999 },
];

describe("périodes à Goma", () => {
  it("lirePeriode : seulement 7 ou 30, sinon 30", () => {
    expect(lirePeriode("7")).toBe(7);
    expect(lirePeriode("30")).toBe(30);
    expect(lirePeriode("90")).toBe(30);
    expect(lirePeriode(undefined)).toBe(30);
  });
  it("le jour change à minuit à Goma (UTC+2), pas à minuit UTC", () => {
    expect(jourGoma(new Date("2026-11-10T21:59:59Z"))).toBe("2026-11-10");
    expect(jourGoma(new Date("2026-11-10T22:00:00Z"))).toBe("2026-11-11");
  });
  it("minuitGoma : minuit local, il y a n jours", () => {
    const maintenant = new Date("2026-11-10T15:30:00Z");
    expect(minuitGoma(0, maintenant).toISOString()).toBe("2026-11-09T22:00:00.000Z");
    expect(minuitGoma(6, maintenant).toISOString()).toBe("2026-11-03T22:00:00.000Z");
  });
  it("la fenêtre traverse un changement d'année", () => {
    expect(joursFenetre(3, new Date("2027-01-01T10:00:00Z"))).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });
  it("joursFenetre : n jours pleins, aujourd'hui compris, du plus ancien au plus récent", () => {
    const jours = joursFenetre(7, new Date("2026-11-10T15:30:00Z"));
    expect(jours).toHaveLength(7);
    expect(jours[0]).toBe("2026-11-04");
    expect(jours[6]).toBe("2026-11-10");
  });
});

describe("paiements", () => {
  const fenetre = new Set(["2026-11-08", "2026-11-09", "2026-11-10"]);
  it("la somme par Famille égale la somme par Prestataire, livraison comprise", () => {
    const parFamille = totalPar(TEST_LIGNES, "famille", fenetre).reduce((s, t) => s + t.montantCents, 0);
    const parPrestataire = totalPar(TEST_LIGNES, "prestataire", fenetre).reduce((s, t) => s + t.montantCents, 0);
    expect(parFamille).toBe(15500);
    expect(parPrestataire).toBe(parFamille);
    expect(sommeMontants(TEST_LIGNES, fenetre)).toBe(parFamille);
  });
  it("hors fenêtre : ignoré", () => {
    expect(totalPar(TEST_LIGNES, "prestataire", fenetre).some((t) => t.cle === "polar")).toBe(false);
  });
  it("serieParJour : un point par jour, zéro réel pour un jour sans paiement", () => {
    const serie = serieParJour(TEST_LIGNES, ["2026-11-08", "2026-11-09", "2026-11-10"]);
    expect(serie.map((p) => p.montantCents)).toEqual([12500, 0, 3000]);
  });
  it("commandesParFamille : comptées par Famille, jamais additionnées entre Familles", () => {
    expect(commandesParFamille(TEST_LIGNES, fenetre)).toEqual({ cosplay: 1, livraison: 1, kit: 2 });
  });
  it("tri : du plus gros au plus petit", () => {
    expect(totalPar(TEST_LIGNES, "famille", fenetre).map((t) => t.cle)).toEqual(["cosplay", "kit", "livraison"]);
  });
});

describe("taux et formats", () => {
  it("pourcentage : null si le dénominateur est nul (jamais 0 % inventé)", () => {
    expect(pourcentage(0, 0)).toBeNull();
    expect(pourcentage(1, 3)).toBe(33);
  });
  it("sommeVue : filtre par jour et ignore les valeurs nulles", () => {
    const vue = [
      { jour: "2026-11-10", n: 4 },
      { jour: "2026-11-10", n: null },
      { jour: "2026-10-01", n: 9 },
      { jour: null, n: 5 },
    ];
    expect(sommeVue(vue, (l) => l.n, new Set(["2026-11-10"]))).toBe(4);
  });
  it("échecs par Prestataire : seuls les échecs du Prestataire comptent, en_cours exclu", () => {
    const r = echecsParPrestataire([
      { prestataire: "pawapay", moyen: "mtn", tentatives: 10, reussies: 6, echouees_client: 1, echouees_prestataire: 1, abandonnees: 1, en_cours: 1 },
      { prestataire: "pawapay", moyen: "airtel", tentatives: 1, reussies: 0, echouees_client: 0, echouees_prestataire: 1, abandonnees: 0, en_cours: 0 },
    ]);
    expect(r).toEqual([{ prestataire: "pawapay", terminees: 10, echouees: 2, taux: 20 }]);
  });
  it("échecs par Prestataire : une ligne en_cours seule ne donne aucun taux", () => {
    const r = echecsParPrestataire([{ prestataire: "polar", moyen: "carte", tentatives: 1, reussies: 0, echouees_client: 0, echouees_prestataire: 0, abandonnees: 0, en_cours: 1 }]);
    expect(r[0].taux).toBeNull();
  });
  it("formaterUsd : toujours en USD", () => {
    expect(formaterUsd(12500, "en")).toBe("$125.00");
  });
});

describe("graphique des 30 jours et Performance du jour (story 9.16 c)", () => {
  it("graduations : de 0 à une borne ronde qui couvre le maximum, pas rond", () => {
    expect(graduations(7_000_000)).toEqual([0, 2_000_000, 4_000_000, 6_000_000, 8_000_000]);
    expect(graduations(5000)).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
    const g = graduations(12_345);
    expect(g[0]).toBe(0);
    expect(g[g.length - 1]).toBeGreaterThanOrEqual(12_345);
    expect(g.length).toBeGreaterThanOrEqual(3);
  });
  it("graduations : sans montant, une échelle de 0 à 5 $ (jamais négative ni NaN)", () => {
    expect(graduations(0)).toEqual([0, 100, 200, 300, 400, 500]);
    expect(graduations(Number.NaN)).toEqual([0, 100, 200, 300, 400, 500]);
    expect(graduations(-50)).toEqual([0, 100, 200, 300, 400, 500]);
  });
  it("graduations : le pas ne descend jamais sous un dollar", () => {
    expect(graduations(150)).toEqual([0, 100, 200]);
  });
  it("indicesDates : une date tous les 5 jours, le dernier jour toujours daté", () => {
    expect(indicesDates(30)).toEqual([4, 9, 14, 19, 24, 29]);
    expect(indicesDates(7)).toEqual([1, 6]);
    expect(indicesDates(0)).toEqual([]);
  });
  it("serieParJour sur 30 jours : 30 points, jours sans vente à 0", () => {
    const jours = joursFenetre(30, new Date("2026-11-10T15:30:00Z"));
    const serie = serieParJour(TEST_LIGNES, jours);
    expect(serie).toHaveLength(30);
    expect(serie.filter((p) => p.montantCents > 0).map((p) => p.jour)).toEqual(["2026-11-08", "2026-11-10"]);
    expect(serie.find((p) => p.jour === "2026-11-09")?.montantCents).toBe(0);
  });
  it("ventesDuJour : nombre et montant ; au plafond, ce sont des minimums", () => {
    expect(ventesDuJour([{ totalCents: 5500 }, { totalCents: 1000 }], 200)).toEqual({ nombre: 2, montantCents: 6500, auMoins: false });
    expect(ventesDuJour([], 200)).toEqual({ nombre: 0, montantCents: 0, auMoins: false });
    expect(ventesDuJour([{ totalCents: 1 }, { totalCents: 1 }], 2).auMoins).toBe(true);
  });
  it("formaterUsdCompact : montant court en USD", () => {
    expect(formaterUsdCompact(7_000_000, "en")).toBe("$70K");
    expect(formaterUsdCompact(0, "en")).toBe("$0");
  });
});

describe("cartes de chiffres (story 9.16 c)", () => {
  const TEST_TEXTES = { usd: (c: number) => formaterUsd(c, "fr"), taux: (n: number) => `${n} %`, aucuneDonnee: "Aucune donnée" };
  const TEST_CHIFFRES = { produitsPublies: 4, commandesPayees: 7, revenuCents: 12345, tentativesReussies: 3, tentativesTerminees: 4 };

  it("tauxReussite : réussies / terminées, arrondi à l'inférieur, jamais 100 % avec un échec", () => {
    expect(tauxReussite(3, 4)).toBe(75);
    expect(tauxReussite(199, 200)).toBe(99);
    expect(tauxReussite(2, 3)).toBe(66);
    expect(tauxReussite(5, 5)).toBe(100);
    expect(tauxReussite(0, 4)).toBe(0);
    expect(tauxReussite(0, 0)).toBeNull();
  });

  it("les 4 cartes, dans l'ordre de la maquette, chaque valeur dans la bonne carte", () => {
    const cartes = cartesChiffres(TEST_CHIFFRES, TEST_TEXTES);
    expect(cartes.map((c) => c.cle)).toEqual(["produitsPublies", "commandesTotal", "revenuTotal", "paiementsReussis"]);
    expect(cartes[0]).toEqual({ cle: "produitsPublies", chiffre: "4", texte: false });
    expect(cartes[1]).toEqual({ cle: "commandesTotal", chiffre: "7", texte: false });
    expect(cartes[2].chiffre).toBe(formaterUsd(12345, "fr"));
    expect(cartes[2].texte).toBe(false);
    expect(cartes[3]).toEqual({ cle: "paiementsReussis", chiffre: "75 %", texte: false });
  });

  it("aucune tentative terminée : « Aucune donnée », écrit plus petit (jamais 0 %)", () => {
    expect(cartesChiffres({ ...TEST_CHIFFRES, tentativesReussies: 0, tentativesTerminees: 0 }, TEST_TEXTES)[3]).toEqual({ cle: "paiementsReussis", chiffre: "Aucune donnée", texte: true });
  });

  it("revenu : écrit plus petit à partir de 1 000 USD, selon la valeur et non la longueur du texte", () => {
    expect(cartesChiffres({ ...TEST_CHIFFRES, revenuCents: 99_999 }, TEST_TEXTES)[2].texte).toBe(false);
    expect(cartesChiffres({ ...TEST_CHIFFRES, revenuCents: 100_000 }, TEST_TEXTES)[2].texte).toBe(true);
    const appels: number[] = [];
    cartesChiffres(TEST_CHIFFRES, { ...TEST_TEXTES, usd: (c) => (appels.push(c), "x") });
    expect(appels).toEqual([12345]);
  });
});
