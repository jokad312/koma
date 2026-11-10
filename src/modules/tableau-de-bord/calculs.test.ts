import { describe, expect, it } from "vitest";
import { commandesParFamille, echecsParPrestataire, formaterUsd, pourcentage, serieParJour, sommeMontants, sommeVue, totalPar, type LignePaiement } from "./calculs";
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
