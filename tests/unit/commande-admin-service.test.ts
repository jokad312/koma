import { describe, expect, it, vi } from "vitest";
import { avancerStatutCommande, confirmerMesuresRecues, confirmerRemboursementAdmin, corrigerAdresseCommande, erreurBaseCommande, traiterDemandeClient, type DependancesAdminCommande } from "@/modules/commande/admin-service";

const NUMERO = "KS-2026-000042";
const AUTEUR = { type: "compte", id: "TEST_admin", role: "admin" };

function deps(s: Partial<DependancesAdminCommande> = {}): DependancesAdminCommande {
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

describe("corrigerAdresseCommande (story 6.2)", () => {
  it("droit vérifié, adresse nettoyée, écriture avec l'auteur", async () => {
    const d = deps();
    await expect(corrigerAdresseCommande(d, { numero: NUMERO, adresse: "  Rue TEST 1, Goma  " })).resolves.toEqual({ ok: true });
    expect(d.exigerDroit).toHaveBeenCalledWith("commandes.changer_statut");
    expect(d.corrigerAdresse).toHaveBeenCalledWith(AUTEUR, NUMERO, "Rue TEST 1, Goma");
  });
  it("sans droit : rien n'est écrit", async () => {
    const d = deps({ exigerDroit: vi.fn(async () => { throw new Error("KS_DROIT_REFUSE"); }) });
    await expect(corrigerAdresseCommande(d, { numero: NUMERO, adresse: "x" })).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    expect(d.corrigerAdresse).not.toHaveBeenCalled();
  });
  it("numéro mal formé, adresse vide ou trop longue : refusé avant tout appel", async () => {
    const d = deps();
    for (const e of [{ numero: "n'importe quoi", adresse: "x" }, { numero: NUMERO, adresse: "   " }, { numero: NUMERO, adresse: "x".repeat(501) }]) {
      await expect(corrigerAdresseCommande(d, e)).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
    }
    expect(d.exigerDroit).not.toHaveBeenCalled();
  });
  it("erreur de la base : traduite, jamais un succès", async () => {
    const d = deps({ corrigerAdresse: vi.fn(async () => ({ erreur: "KS_PAS_DE_LIVRAISON" })) });
    await expect(corrigerAdresseCommande(d, { numero: NUMERO, adresse: "x" })).resolves.toEqual({ ok: false, erreur: "pas_de_livraison" });
    expect(d.invalider).not.toHaveBeenCalled();
  });
});

describe("avancerStatutCommande (story 6.3)", () => {
  it("seuls en_fabrication, expediee et livree sont posables : payee, offerte, echouee, expiree sont refusés avant tout appel (règle 2)", async () => {
    const d = deps();
    for (const vers of ["payee", "offerte", "echouee", "expiree", "annulee", "en_attente", "n'importe quoi"]) {
      await expect(avancerStatutCommande(d, { numero: NUMERO, vers })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
    }
    expect(d.avancerStatut).not.toHaveBeenCalled();
  });
  it("transition valide : l'auteur, le numéro et le suivi (texte libre) sont transmis", async () => {
    const d = deps();
    await expect(avancerStatutCommande(d, { numero: NUMERO, vers: "expediee", numeroSuivi: "  AB 123/x  " })).resolves.toEqual({ ok: true });
    expect(d.avancerStatut).toHaveBeenCalledWith(AUTEUR, NUMERO, "expediee", "AB 123/x");
  });
  it("suivi vide : transmis comme absent ; suivi sur un autre statut que l'expédition : refusé", async () => {
    const d = deps();
    await avancerStatutCommande(d, { numero: NUMERO, vers: "expediee", numeroSuivi: "  " });
    expect(d.avancerStatut).toHaveBeenCalledWith(AUTEUR, NUMERO, "expediee", null);
    await expect(avancerStatutCommande(d, { numero: NUMERO, vers: "livree", numeroSuivi: "AB" })).resolves.toEqual({ ok: false, erreur: "numero_suivi_invalide" });
    await expect(avancerStatutCommande(d, { numero: NUMERO, vers: "expediee", numeroSuivi: "x".repeat(101) })).resolves.toEqual({ ok: false, erreur: "numero_suivi_invalide" });
  });
  it("transition interdite ou mesures non reçues côté base : l'erreur est rendue, rien n'est présenté comme fait", async () => {
    await expect(avancerStatutCommande(deps({ avancerStatut: vi.fn(async () => ({ erreur: "KS_TRANSITION_INTERDITE" })) }), { numero: NUMERO, vers: "livree" })).resolves.toEqual({ ok: false, erreur: "transition_interdite" });
    await expect(avancerStatutCommande(deps({ avancerStatut: vi.fn(async () => ({ erreur: "KS_MESURES_NON_RECUES" })) }), { numero: NUMERO, vers: "en_fabrication" })).resolves.toEqual({ ok: false, erreur: "mesures_non_recues" });
  });
  it("sans droit : refusé", async () => {
    const d = deps({ exigerDroit: vi.fn(async () => { throw new Error("KS_DROIT_REFUSE"); }) });
    await expect(avancerStatutCommande(d, { numero: NUMERO, vers: "livree" })).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    expect(d.avancerStatut).not.toHaveBeenCalled();
  });
});

describe("confirmerMesuresRecues (story 6.5)", () => {
  const LIGNE = "11111111-1111-4111-8111-111111111111";
  it("droit « mesures.verifier » exigé, puis écriture", async () => {
    const d = deps();
    await expect(confirmerMesuresRecues(d, { ligneId: LIGNE })).resolves.toEqual({ ok: true });
    expect(d.exigerDroit).toHaveBeenCalledWith("mesures.verifier");
    expect(d.confirmerMesures).toHaveBeenCalledWith(AUTEUR, LIGNE);
  });
  it("identifiant mal formé : refusé ; déjà reçues : erreur rendue", async () => {
    await expect(confirmerMesuresRecues(deps(), { ligneId: "x" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
    await expect(confirmerMesuresRecues(deps({ confirmerMesures: vi.fn(async () => ({ erreur: "KS_MESURES_DEJA_RECUES" })) }), { ligneId: LIGNE })).resolves.toEqual({ ok: false, erreur: "mesures_deja_recues" });
  });
});

describe("erreurBaseCommande", () => {
  it("code inconnu : générique", () => {
    expect(erreurBaseCommande("autre chose")).toBe("generique");
  });
});

describe("traiterDemandeClient et confirmerRemboursementAdmin (story 6.6)", () => {
  const ID = "22222222-2222-4222-8222-222222222222";
  it("droit « remboursement.valider » exigé ; décision transmise", async () => {
    const d = deps();
    await expect(traiterDemandeClient(d, { demandeId: ID, decision: "accepter" })).resolves.toEqual({ ok: true });
    expect(d.exigerDroit).toHaveBeenCalledWith("remboursement.valider");
    expect(d.traiterDemande).toHaveBeenCalledWith(AUTEUR, ID, "accepter");
  });
  it("décision ou identifiant invalides : refusés avant tout appel ; sans droit : refusé", async () => {
    const d = deps();
    await expect(traiterDemandeClient(d, { demandeId: ID, decision: "peut-etre" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
    await expect(traiterDemandeClient(d, { demandeId: "x", decision: "refuser" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
    expect(d.traiterDemande).not.toHaveBeenCalled();
    const sans = deps({ exigerDroit: vi.fn(async () => { throw new Error("KS_DROIT_REFUSE"); }) });
    await expect(traiterDemandeClient(sans, { demandeId: ID, decision: "refuser" })).resolves.toEqual({ ok: false, erreur: "non_autorise" });
  });
  it("remboursement : sans preuve (vide ou trop courte), rien n'est enregistré", async () => {
    const d = deps();
    for (const preuve of ["", "   ", "ab"]) await expect(confirmerRemboursementAdmin(d, { cibleType: "commande", cibleId: ID, preuve })).resolves.toEqual({ ok: false, erreur: "preuve_requise" });
    expect(d.confirmerRemboursement).not.toHaveBeenCalled();
  });
  it("remboursement avec preuve : transmis (commande ou trop-perçu) ; cible inconnue refusée", async () => {
    const d = deps();
    await expect(confirmerRemboursementAdmin(d, { cibleType: "trop_percu", cibleId: ID, preuve: "  VIR-TEST-1  " })).resolves.toEqual({ ok: true });
    expect(d.confirmerRemboursement).toHaveBeenCalledWith(AUTEUR, "trop_percu", ID, "VIR-TEST-1");
    await expect(confirmerRemboursementAdmin(d, { cibleType: "pass", cibleId: ID, preuve: "VIR-TEST-1" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
  });
  it("erreur de la base : rendue, jamais un succès", async () => {
    const d = deps({ confirmerRemboursement: vi.fn(async () => ({ erreur: "KS_REMBOURSEMENT_IMPOSSIBLE" })) });
    await expect(confirmerRemboursementAdmin(d, { cibleType: "commande", cibleId: ID, preuve: "VIR-TEST-1" })).resolves.toEqual({ ok: false, erreur: "remboursement_impossible" });
  });
});
