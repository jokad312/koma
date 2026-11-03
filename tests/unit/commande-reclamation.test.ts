import { describe, expect, it, vi } from "vitest";
import { avancerReclamation, type DependancesAdminCommande } from "@/modules/commande/admin-service";
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
    confirmerRemboursement: vi.fn(async () => ({ erreur: null })),
    invalider: vi.fn(),
    ...s,
  };
}

describe("avancerReclamation (story 6.7)", () => {
  it("étapes connues seulement ; le décompte du stock ne concerne que le remplacement remis", async () => {
    const d = depsAdmin();
    await avancerReclamation(d, { demandeId: LIGNE, etape: "remplacement_remis", depuisStock: true });
    expect(d.traiterReclamation).toHaveBeenLastCalledWith(AUTEUR, LIGNE, "remplacement_remis", true);
    await avancerReclamation(d, { demandeId: LIGNE, etape: "accepter", depuisStock: true });
    expect(d.traiterReclamation).toHaveBeenLastCalledWith(AUTEUR, LIGNE, "accepter", false);
    await expect(avancerReclamation(d, { demandeId: LIGNE, etape: "rembourser" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
  });
  it("sans droit d'administrateur : refusé ; stock insuffisant : erreur rendue", async () => {
    const sans = depsAdmin({ exigerDroit: vi.fn(async () => { throw new Error("KS_DROIT_REFUSE"); }) });
    await expect(avancerReclamation(sans, { demandeId: LIGNE, etape: "accepter" })).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    const stock = depsAdmin({ traiterReclamation: vi.fn(async () => ({ erreur: "KS_STOCK_INSUFFISANT" })) });
    await expect(avancerReclamation(stock, { demandeId: LIGNE, etape: "remplacement_remis", depuisStock: true })).resolves.toEqual({ ok: false, erreur: "stock_insuffisant" });
  });
});
