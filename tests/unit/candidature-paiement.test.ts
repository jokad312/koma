import { describe, expect, it, vi } from "vitest";
import { creerCommandeStand, lireRecapitulatifStand, nommerAide } from "@/modules/evenements/candidature-paiement";
import type { DependancesNommerAide, DependancesPaiementStand, RecapStandBrut } from "@/modules/evenements/candidature-types";

vi.mock("server-only", () => ({}));

const COMPTE = "11111111-1111-4111-8111-111111111111";
const CANDIDATURE = "55555555-5555-4555-8555-555555555555";
const PASS = "66666666-6666-4666-8666-666666666666";

const brut = (s: Partial<RecapStandBrut> = {}): RecapStandBrut => ({
  candidature_id: CANDIDATURE,
  evenement_id: "33333333-3333-4333-8333-333333333333",
  expire_le: "2026-12-01T12:00:00Z",
  type_pass_id: "44444444-4444-4444-8444-444444444444",
  nom_fr: "TEST_Stand",
  nom_en: "TEST_Stand EN",
  prix_cents: 4000,
  reduction_cents: 0,
  sous_total_cents: 4000,
  total_cents: 4000,
  code: null,
  ...s,
});

function faux(sur: Partial<DependancesPaiementStand> = {}): DependancesPaiementStand {
  return {
    exigerCompte: async () => ({ compteId: COMPTE, auteur: { type: "compte", id: COMPTE, role: null } }),
    nomDuCompte: async () => "TEST_ Alice Exposante",
    nomAideProvisoire: async (langue) => (langue === "en" ? "TEST_ Stand helper" : "TEST_ Aide du stand"),
    recapitulatif: vi.fn(async () => ({ recap: brut() })),
    creerCommande: vi.fn(async () => ({ numero: "KS-2026-000900", expireLe: "2026-12-01T12:00:00Z" })),
    ...sur,
  };
}

const creation = (s: Record<string, unknown> = {}) => ({ candidatureId: CANDIDATURE, mention: true, totalAttenduCents: 4000, cleIdempotence: "test-cle-0001", ...s });

describe("lireRecapitulatifStand", () => {
  it("rend le prix, la réduction et le total lus en base, dans la langue demandée", async () => {
    const r = await lireRecapitulatifStand(faux(), { candidatureId: CANDIDATURE }, "en");
    expect(r).toMatchObject({ ok: true, recap: { nom: "TEST_Stand EN", prixCents: 4000, totalCents: 4000 } });
  });

  it.each([
    ["KS_CANDIDATURE_INTROUVABLE", "introuvable"],
    ["KS_CANDIDATURE_EXPIREE", "expiree"],
    ["KS_CANDIDATURE_REFUSEE", "refusee"],
    ["KS_CANDIDATURE_DEJA_COMMANDEE", "deja_commandee"],
    ["KS_VENTE_FERMEE", "vente_fermee"],
  ])("erreur %s : code %s (délai dépassé, autre Compte, refus…)", async (message, code) => {
    const r = await lireRecapitulatifStand(faux({ recapitulatif: async () => ({ erreur: message }) }), { candidatureId: CANDIDATURE }, "fr");
    expect(r).toEqual({ ok: false, erreur: code });
  });

  it("refuse sans session", async () => {
    const deps = faux({
      exigerCompte: async () => {
        throw Object.assign(new Error("KS_NON_CONNECTE"), { code: "KS_NON_CONNECTE" });
      },
    });
    expect(await lireRecapitulatifStand(deps, { candidatureId: CANDIDATURE }, "fr")).toEqual({ ok: false, erreur: "non_connecte" });
  });
});

describe("creerCommandeStand", () => {
  it("sans nom d'aide : nom provisoire dans la langue, aide à saisir plus tard", async () => {
    const deps = faux();
    const r = await creerCommandeStand(deps, creation(), "fr");
    expect(r).toEqual({ ok: true, numero: "KS-2026-000900", expireLe: "2026-12-01T12:00:00Z" });
    expect(vi.mocked(deps.creerCommande).mock.calls[0][0]).toMatchObject({ nomTitulaire: "TEST_ Alice Exposante", nomAide: "TEST_ Aide du stand", aideASaisir: true });
  });

  it("avec un nom d'aide : nom nettoyé, rien à saisir plus tard", async () => {
    const deps = faux();
    await creerCommandeStand(deps, creation({ nomAide: "  Bob   Aide " }), "en");
    expect(vi.mocked(deps.creerCommande).mock.calls[0][0]).toMatchObject({ nomAide: "Bob Aide", aideASaisir: false });
  });

  it("le nom du Compte prime sur le nom envoyé par le navigateur ; sans nom de Compte, le nom saisi est exigé", async () => {
    const a = faux();
    await creerCommandeStand(a, creation({ nomTitulaire: "Pirate Test" }), "fr");
    expect(vi.mocked(a.creerCommande).mock.calls[0][0].nomTitulaire).toBe("TEST_ Alice Exposante");
    const b = faux({ nomDuCompte: async () => null });
    expect(await creerCommandeStand(b, creation(), "fr")).toEqual({ ok: false, erreur: "titulaire" });
    expect(b.creerCommande).not.toHaveBeenCalled();
    const c = faux({ nomDuCompte: async () => null });
    expect(await creerCommandeStand(c, creation({ nomTitulaire: "Cara Test" }), "fr")).toMatchObject({ ok: true });
  });

  it("sans la mention photos et vidéos : refusé, rien n'est créé ; un nom d'aide invalide aussi", async () => {
    const deps = faux();
    expect(await creerCommandeStand(deps, creation({ mention: false }), "fr")).toEqual({ ok: false, erreur: "mention" });
    expect(await creerCommandeStand(deps, creation({ nomAide: "<b>" }), "fr")).toEqual({ ok: false, erreur: "titulaire" });
    expect(deps.creerCommande).not.toHaveBeenCalled();
  });

  it("l'acceptation envoyée est la mention photos et vidéos, avec sa version", async () => {
    const deps = faux();
    await creerCommandeStand(deps, creation(), "fr");
    expect(vi.mocked(deps.creerCommande).mock.calls[0][0].acceptations).toEqual([{ objet: "pass_photos_video", version: expect.any(String) }]);
  });

  it("total changé : rien n'est créé, le nouveau Récapitulatif est rendu", async () => {
    const deps = faux({
      creerCommande: async () => ({ erreur: "KS_TOTAL_CHANGE" }),
      recapitulatif: async () => ({ recap: brut({ total_cents: 3000, prix_cents: 3000 }) }),
    });
    const r = await creerCommandeStand(deps, creation(), "fr");
    expect(r).toMatchObject({ ok: false, erreur: "total_change", recap: { totalCents: 3000 } });
  });

  it.each([
    ["KS_CANDIDATURE_INTROUVABLE", "introuvable"],
    ["KS_CANDIDATURE_EXPIREE", "expiree"],
    ["KS_CANDIDATURE_REFUSEE", "refusee"],
    ["KS_COMMANDE_EN_ATTENTE", "commande_en_attente"],
    ["KS_CODE_INCONNU", "code_inconnu"],
    ["quelque chose d'inconnu", "erreur"],
  ])("refus de la base %s : code %s, jamais un succès", async (message, code) => {
    const r = await creerCommandeStand(faux({ creerCommande: async () => ({ erreur: message }) }), creation(), "fr");
    expect(r).toEqual({ ok: false, erreur: code });
  });
});

describe("nommerAide", () => {
  const dep = (sur: Partial<DependancesNommerAide> = {}): DependancesNommerAide => ({
    compte: async () => ({ compteId: COMPTE, auteur: { type: "compte", id: COMPTE, role: null } }),
    nommer: vi.fn(async () => ({ erreur: null })),
    ...sur,
  });

  it("nettoie le nom et l'envoie avec l'auteur de la session", async () => {
    const d = dep();
    expect(await nommerAide(d, { passId: PASS, nom: "  Bob   Aide " })).toEqual({ ok: true });
    expect(vi.mocked(d.nommer).mock.calls[0][0]).toMatchObject({ passId: PASS, nom: "Bob Aide", auteur: { id: COMPTE } });
  });

  it("refuse un nom invalide sans appeler la base", async () => {
    const d = dep();
    expect(await nommerAide(d, { passId: PASS, nom: "A" })).toEqual({ ok: false, erreur: "nom_invalide" });
    expect(await nommerAide(d, { passId: PASS, nom: "<script>" })).toEqual({ ok: false, erreur: "nom_invalide" });
    expect(d.nommer).not.toHaveBeenCalled();
  });

  it.each([
    ["KS_PASS_INTROUVABLE", "introuvable"],
    ["KS_NOM_DEJA_SAISI", "deja_saisi"],
    ["KS_EVENEMENT_COMMENCE", "evenement_commence"],
    ["autre", "generique"],
  ])("refus de la base %s : code %s", async (message, code) => {
    expect(await nommerAide(dep({ nommer: async () => ({ erreur: message }) }), { passId: PASS, nom: "Bob Aide" })).toEqual({ ok: false, erreur: code });
  });

  it("sans session : refusé", async () => {
    expect(await nommerAide(dep({ compte: async () => ({ erreur: "non_connecte" }) }), { passId: PASS, nom: "Bob Aide" })).toEqual({ ok: false, erreur: "non_connecte" });
  });
});
