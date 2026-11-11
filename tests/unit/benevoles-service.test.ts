// Story 7.7 : service des accès bénévoles. Dépendances fausses nommées TEST_ : droit Admin exigé avant tout appel, validation de l'email,
// états rendus (attribué, déjà, mis à jour, sans compte), codes d'erreur, aucune donnée saisie dans les journaux.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attribuerAcces, retirerAcces } from "@/modules/benevoles/service";
import type { DependancesBenevoles } from "@/modules/benevoles/types";

const EVENEMENT = "00000000-0000-4000-8000-0000000000e1";
const ACCES = "00000000-0000-4000-8000-0000000000a1";
const AUTEUR = { type: "compte" as const, id: "00000000-0000-4000-8000-0000000000c1", role: "admin" as const };

function faux(s: Partial<DependancesBenevoles> = {}): DependancesBenevoles {
  return {
    exigerDroit: vi.fn(async () => ({ auteur: AUTEUR })),
    attribuer: vi.fn(async () => ({ erreur: null, statut: "attribue" })),
    retirer: vi.fn(async () => ({ erreur: null, retire: true })),
    ...s,
  };
}
const refus = (code: string) => vi.fn(async () => { throw new Error(code); });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("attribuerAcces", () => {
  it("normalise l'email (espaces, casse) et transmet l'auteur vérifié", async () => {
    const d = faux();
    expect(await attribuerAcces(d, { evenementId: EVENEMENT, email: "  TEST.Benevole@Example.INVALID " })).toEqual({ ok: true, statut: "attribue" });
    expect(d.attribuer).toHaveBeenCalledWith({ auteur: AUTEUR, evenementId: EVENEMENT, email: "test.benevole@example.invalid" });
  });
  it("rend chaque état de la base tel quel, « sans compte » compris", async () => {
    for (const statut of ["attribue", "deja", "mis_a_jour", "sans_compte"] as const) {
      const d = faux({ attribuer: vi.fn(async () => ({ erreur: null, statut })) });
      expect(await attribuerAcces(d, { evenementId: EVENEMENT, email: "test@example.invalid" })).toEqual({ ok: true, statut });
    }
  });
  it("un état inconnu de la base n'est jamais présenté comme un succès", async () => {
    for (const statut of [null, "ok", "admin"]) {
      const d = faux({ attribuer: vi.fn(async () => ({ erreur: null, statut })) });
      expect(await attribuerAcces(d, { evenementId: EVENEMENT, email: "test@example.invalid" })).toEqual({ ok: false, erreur: "generique" });
    }
  });
  it("email invalide ou absent : refusé avant le droit et avant la base", async () => {
    const d = faux();
    for (const email of ["", "pas-un-email", "a@b", `${"x".repeat(250)}@example.invalid`, null, 42, undefined]) {
      expect(await attribuerAcces(d, { evenementId: EVENEMENT, email }), String(email)).toEqual({ ok: false, erreur: "email_invalide" });
    }
    expect(d.exigerDroit).not.toHaveBeenCalled();
    expect(d.attribuer).not.toHaveBeenCalled();
  });
  it("identifiant d'Événement invalide : refusé, aucun appel", async () => {
    const d = faux();
    expect(await attribuerAcces(d, { evenementId: "pas-un-uuid", email: "test@example.invalid" })).toEqual({ ok: false, erreur: "generique" });
    expect(await attribuerAcces(d, { evenementId: undefined, email: "test@example.invalid" })).toEqual({ ok: false, erreur: "generique" });
    expect(d.attribuer).not.toHaveBeenCalled();
  });
  it("visiteur, Assistant, bénévole : refusés avant tout appel à la base", async () => {
    for (const [code, erreur] of [["KS_NON_CONNECTE", "non_connecte"], ["KS_DROIT_REFUSE", "non_autorise"]] as const) {
      const d = faux({ exigerDroit: refus(code) });
      expect(await attribuerAcces(d, { evenementId: EVENEMENT, email: "test@example.invalid" })).toEqual({ ok: false, erreur });
      expect(d.attribuer).not.toHaveBeenCalled();
    }
  });
  it("vérification du droit impossible : échec générique, jamais un succès", async () => {
    const d = faux({ exigerDroit: refus("KS_VERIFICATION_IMPOSSIBLE") });
    expect(await attribuerAcces(d, { evenementId: EVENEMENT, email: "test@example.invalid" })).toEqual({ ok: false, erreur: "generique" });
    expect(d.attribuer).not.toHaveBeenCalled();
  });
  it("traduit les refus de la base en codes d'interface", async () => {
    const cas = [
      ["KS_DROIT_REFUSE", "non_autorise"],
      ["KS_EMAIL_INVALIDE", "email_invalide"],
      ["KS_EVENEMENT_PASSE", "evenement_passe"],
      ["KS_EVENEMENT_SANS_DATE", "evenement_sans_date"],
      ["KS_EVENEMENT_INTROUVABLE", "generique"],
      ["42501", "generique"],
    ] as const;
    for (const [brut, erreur] of cas) {
      const d = faux({ attribuer: vi.fn(async () => ({ erreur: brut, statut: null })) });
      expect(await attribuerAcces(d, { evenementId: EVENEMENT, email: "test@example.invalid" }), brut).toEqual({ ok: false, erreur });
    }
  });
  it("une exception de la base donne un échec générique, sans email dans le journal", async () => {
    const d = faux({ attribuer: vi.fn(async () => { throw new Error("boom test@example.invalid"); }) });
    expect(await attribuerAcces(d, { evenementId: EVENEMENT, email: "test@example.invalid" })).toEqual({ ok: false, erreur: "generique" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("example.invalid");
  });
  it("un refus de la base n'écrit que le code KS_ dans le journal", async () => {
    const d = faux({ attribuer: vi.fn(async () => ({ erreur: "KS_EVENEMENT_PASSE test@example.invalid", statut: null })) });
    await attribuerAcces(d, { evenementId: EVENEMENT, email: "test@example.invalid" });
    const journal = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(journal).toContain("KS_EVENEMENT_PASSE");
    expect(journal).not.toContain("example.invalid");
  });
});

describe("retirerAcces", () => {
  it("retire un accès de cet Événement", async () => {
    const d = faux();
    expect(await retirerAcces(d, { evenementId: EVENEMENT, accesId: ACCES })).toEqual({ ok: true, retire: true });
    expect(d.retirer).toHaveBeenCalledWith({ auteur: AUTEUR, evenementId: EVENEMENT, accesId: ACCES });
  });
  it("un accès absent ou d'un autre Événement : la base répond « rien retiré », pas un succès inventé", async () => {
    const d = faux({ retirer: vi.fn(async () => ({ erreur: null, retire: false })) });
    expect(await retirerAcces(d, { evenementId: EVENEMENT, accesId: ACCES })).toEqual({ ok: true, retire: false });
  });
  it("identifiants invalides : refusés, aucun appel", async () => {
    const d = faux();
    expect(await retirerAcces(d, { evenementId: "x", accesId: ACCES })).toEqual({ ok: false, erreur: "generique" });
    expect(await retirerAcces(d, { evenementId: EVENEMENT, accesId: "x" })).toEqual({ ok: false, erreur: "generique" });
    expect(d.exigerDroit).not.toHaveBeenCalled();
  });
  it("sans le droit : refusé avant la base", async () => {
    for (const [code, erreur] of [["KS_NON_CONNECTE", "non_connecte"], ["KS_DROIT_REFUSE", "non_autorise"]] as const) {
      const d = faux({ exigerDroit: refus(code) });
      expect(await retirerAcces(d, { evenementId: EVENEMENT, accesId: ACCES })).toEqual({ ok: false, erreur });
      expect(d.retirer).not.toHaveBeenCalled();
    }
  });
  it("refus de la base relayé, exception : échec générique", async () => {
    expect(await retirerAcces(faux({ retirer: vi.fn(async () => ({ erreur: "KS_DROIT_REFUSE", retire: false })) }), { evenementId: EVENEMENT, accesId: ACCES })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await retirerAcces(faux({ retirer: vi.fn(async () => { throw new Error("x"); }) }), { evenementId: EVENEMENT, accesId: ACCES })).toEqual({ ok: false, erreur: "generique" });
  });
});
