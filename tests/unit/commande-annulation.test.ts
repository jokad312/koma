import { describe, expect, it, vi } from "vitest";
import { demanderAnnulation, type DependancesAnnulation } from "@/modules/commande/annulation";
import { rendreCommandeAnnulee, rendreCommandeRemboursee } from "@/modules/envois/modeles/statut-commande";

const NUMERO = "KS-2026-000042";

function deps(s: Partial<DependancesAnnulation> = {}): DependancesAnnulation {
  return { compteId: vi.fn(async () => "TEST_compte"), demander: vi.fn(async () => ({ erreur: null })), ...s };
}

describe("demanderAnnulation (story 6.6)", () => {
  it("le Compte vient de la session : la demande part avec lui", async () => {
    const d = deps();
    await expect(demanderAnnulation(d, { numero: NUMERO })).resolves.toEqual({ ok: true });
    expect(d.demander).toHaveBeenCalledWith("TEST_compte", NUMERO);
  });
  it("non connecté ou numéro mal formé : aucune demande", async () => {
    const d = deps({ compteId: vi.fn(async () => null) });
    await expect(demanderAnnulation(d, { numero: NUMERO })).resolves.toEqual({ ok: false, erreur: "non_connecte" });
    await expect(demanderAnnulation(deps(), { numero: "n'importe quoi" })).resolves.toEqual({ ok: false, erreur: "entree_invalide" });
    expect(d.demander).not.toHaveBeenCalled();
  });
  it("refus de la base : traduit, jamais un succès", async () => {
    const cas: Array<[string, string]> = [["KS_ANNULATION_IMPOSSIBLE", "annulation_impossible"], ["KS_COMMANDE_INTROUVABLE", "commande_introuvable"], ["KS_DEMANDE_EN_COURS", "demande_en_cours"], ["autre", "generique"]];
    for (const [erreur, attendu] of cas) {
      await expect(demanderAnnulation(deps({ demander: vi.fn(async () => ({ erreur })) }), { numero: NUMERO })).resolves.toEqual({ ok: false, erreur: attendu });
    }
  });
});

const donnees = { nomSite: "TEST_site", numero: NUMERO, url: "https://TEST.invalid/fr/commande/x", montantCents: 10900 };

describe("emails d'annulation et de remboursement (story 6.6)", () => {
  it("annulation : numéro, montant à rendre en USD, lien", () => {
    const m = rendreCommandeAnnulee("fr", donnees);
    expect(m.sujet).toContain(NUMERO);
    expect(m.texte).toContain("109,00");
    expect(m.texte).not.toMatch(/1090|109,000/);
    expect(m.texte).toContain(donnees.url);
  });
  it("remboursement : montant rendu, en français et en anglais", () => {
    expect(rendreCommandeRemboursee("fr", donnees).texte).toMatch(/Montant rendu/);
    expect(rendreCommandeRemboursee("en", donnees).texte).toMatch(/Amount returned/);
  });
});
