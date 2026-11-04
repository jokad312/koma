import { describe, expect, it, vi } from "vitest";
import { avancerReclamation, marquerStockVerifieAdmin, type DependancesAdminCommande } from "@/modules/commande/admin-service";
import { signalerProbleme, type DependancesReclamation } from "@/modules/commande/reclamation";

const NUMERO = "KS-2026-000042";
const LIGNE = "33333333-3333-4333-8333-333333333333";

function deps(s: Partial<DependancesReclamation> = {}): DependancesReclamation {
  return { compteId: vi.fn(async () => "TEST_compte"), signaler: vi.fn(async () => ({ erreur: null })), ...s };
}

describe("signalerProbleme (story 6.7)", () => {
  it("description obligatoire (vide ou espaces refusés avant tout appel) ; aucune photo n'est demandée", async () => {
    const d = deps();
    for (const description of ["", "   "]) await expect(signalerProbleme(d, { numero: NUMERO, ligneId: LIGNE, description })).resolves.toEqual({ ok: false, erreur: "description_requise" });
    await expect(signalerProbleme(d, { numero: NUMERO, ligneId: LIGNE, description: "x".repeat(2001) })).resolves.toEqual({ ok: false, erreur: "description_requise" });
    expect(d.signaler).not.toHaveBeenCalled();
  });
  it("le Compte vient de la session ; la description est nettoyée", async () => {
    const d = deps();
    await expect(signalerProbleme(d, { numero: NUMERO, ligneId: LIGNE, description: "  Coutures défaites  " })).resolves.toEqual({ ok: true });
    expect(d.signaler).toHaveBeenCalledWith("TEST_compte", NUMERO, LIGNE, "Coutures défaites");
  });
  it("numéro ou ligne mal formés, non connecté : aucun signalement", async () => {
    const d = deps({ compteId: vi.fn(async () => null) });
    await expect(signalerProbleme(deps(), { numero: "x", ligneId: LIGNE, description: "a" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
    await expect(signalerProbleme(deps(), { numero: NUMERO, ligneId: "x", description: "a" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
    await expect(signalerProbleme(d, { numero: NUMERO, ligneId: LIGNE, description: "a" })).resolves.toEqual({ ok: false, erreur: "non_connecte" });
    expect(d.signaler).not.toHaveBeenCalled();
  });
  it("refus de la base (48 h dépassées, Sur-mesure, déjà en cours) : traduit, jamais un succès", async () => {
    const refus = deps({ signaler: vi.fn(async () => ({ erreur: "KS_RECLAMATION_IMPOSSIBLE" })) });
    await expect(signalerProbleme(refus, { numero: NUMERO, ligneId: LIGNE, description: "a" })).resolves.toEqual({ ok: false, erreur: "reclamation_impossible" });
    const inconnu = deps({ signaler: vi.fn(async () => ({ erreur: "autre" })) });
    await expect(signalerProbleme(inconnu, { numero: NUMERO, ligneId: LIGNE, description: "a" })).resolves.toEqual({ ok: false, erreur: "generique" });
  });
});

const AUTEUR = { type: "compte", id: "TEST_admin" };
function depsAdmin(s: Partial<DependancesAdminCommande> = {}): DependancesAdminCommande {
  return {
    exigerDroit: vi.fn(async () => ({ auteur: AUTEUR })),
    corrigerAdresse: vi.fn(async () => ({ erreur: null })),
    avancerStatut: vi.fn(async () => ({ erreur: null })),
    confirmerMesures: vi.fn(async () => ({ erreur: null })),
    traiterDemande: vi.fn(async () => ({ erreur: null })),
    traiterReclamation: vi.fn(async () => ({ erreur: null })),
    marquerStockVerifie: vi.fn(async () => ({ erreur: null })),
    confirmerRemboursement: vi.fn(async () => ({ erreur: null })),
    invalider: vi.fn(),
    ...s,
  };
}

describe("avancerReclamation (story 6.7)", () => {
  it("étapes connues seulement ; le décompte du stock ne concerne que le remplacement remis", async () => {
    const d = depsAdmin();
    await avancerReclamation(d, { demandeId: LIGNE, etape: "remplacement_remis", depuisStock: true });
    expect(d.traiterReclamation).toHaveBeenLastCalledWith(AUTEUR, LIGNE, "remplacement_remis", true, null);
    await avancerReclamation(d, { demandeId: LIGNE, etape: "accepter", depuisStock: true });
    expect(d.traiterReclamation).toHaveBeenLastCalledWith(AUTEUR, LIGNE, "accepter", false, null);
    await expect(avancerReclamation(d, { demandeId: LIGNE, etape: "rembourser" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
  });
  it("sans droit d'administrateur : refusé ; stock insuffisant : erreur rendue", async () => {
    const sans = depsAdmin({ exigerDroit: vi.fn(async () => { throw new Error("KS_DROIT_REFUSE"); }) });
    await expect(avancerReclamation(sans, { demandeId: LIGNE, etape: "accepter" })).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    const stock = depsAdmin({ traiterReclamation: vi.fn(async () => ({ erreur: "KS_STOCK_INSUFFISANT" })) });
    await expect(avancerReclamation(stock, { demandeId: LIGNE, etape: "remplacement_remis", depuisStock: true })).resolves.toEqual({ ok: false, erreur: "stock_insuffisant" });
  });
});

describe("avancerReclamation : quantité remplacée", () => {
  it("quantité entière transmise telle quelle pour le remplacement remis ; ligne entière (null) par défaut", async () => {
    const d = depsAdmin();
    await avancerReclamation(d, { demandeId: LIGNE, etape: "remplacement_remis", depuisStock: true, quantite: 2 });
    expect(d.traiterReclamation).toHaveBeenLastCalledWith(AUTEUR, LIGNE, "remplacement_remis", true, 2);
    await avancerReclamation(d, { demandeId: LIGNE, etape: "remplacement_remis" });
    expect(d.traiterReclamation).toHaveBeenLastCalledWith(AUTEUR, LIGNE, "remplacement_remis", false, null);
  });
  it("quantité non entière, nulle, négative ou hors étape : refusée avant tout appel", async () => {
    const d = depsAdmin();
    for (const quantite of [0, -1, 1.5, Number.NaN, 10001]) {
      await expect(avancerReclamation(d, { demandeId: LIGNE, etape: "remplacement_remis", quantite })).resolves.toEqual({ ok: false, erreur: "quantite_invalide" });
    }
    await expect(avancerReclamation(d, { demandeId: LIGNE, etape: "accepter", quantite: 1 })).resolves.toEqual({ ok: false, erreur: "quantite_invalide" });
    expect(d.traiterReclamation).not.toHaveBeenCalled();
  });
  it("quantité supérieure à la ligne (refus de la base) : erreur traduite", async () => {
    const d = depsAdmin({ traiterReclamation: vi.fn(async () => ({ erreur: "KS_QUANTITE_INVALIDE" })) });
    await expect(avancerReclamation(d, { demandeId: LIGNE, etape: "remplacement_remis", quantite: 9 })).resolves.toEqual({ ok: false, erreur: "quantite_invalide" });
  });
});

describe("marquerStockVerifieAdmin (tâche « Vérifier le stock »)", () => {
  it("droit d'administrateur, identifiant valide, puis fonction SQL ; le refus de la base est traduit", async () => {
    const d = depsAdmin();
    await expect(marquerStockVerifieAdmin(d, { commandeId: LIGNE })).resolves.toEqual({ ok: true });
    expect(d.marquerStockVerifie).toHaveBeenCalledWith(AUTEUR, LIGNE);
    await expect(marquerStockVerifieAdmin(d, { commandeId: "pas-un-uuid" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
    const sans = depsAdmin({ exigerDroit: vi.fn(async () => { throw new Error("KS_DROIT_REFUSE"); }) });
    await expect(marquerStockVerifieAdmin(sans, { commandeId: LIGNE })).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    const deja = depsAdmin({ marquerStockVerifie: vi.fn(async () => ({ erreur: "KS_STOCK_DEJA_VERIFIE" })) });
    await expect(marquerStockVerifieAdmin(deja, { commandeId: LIGNE })).resolves.toEqual({ ok: false, erreur: "stock_deja_verifie" });
  });
});
