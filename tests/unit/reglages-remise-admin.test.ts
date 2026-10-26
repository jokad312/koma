import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enregistrerReglage } from "@/modules/admin/service";
import { creerTestDependancesAdmin } from "../doubles/TEST_dependances-admin";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({ courant: null as unknown }));
vi.mock("@/modules/admin/dependances", () => ({ dependances: () => faux.courant }));

import { enregistrerReglage as actionReglage } from "@/modules/admin/actions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("enregistrerReglage : forfaits de livraison (story 2.3)", () => {
  it.each([
    ["5", "500"],
    ["5,50", "550"],
    ["5.5", "550"],
    ["0", "0"],
    ["1000", "100000"],
  ])("« %s » est écrit en %s centimes, droit reglages.modifier, cache invalidé après", async (saisie, cents) => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "forfait_livraison_goma_cents", valeur: saisie })).toEqual({ ok: true, valeur: cents });
    expect(appels.ordre).toEqual(["droit", "ecriture", "invalidation"]);
    expect(appels.droits).toEqual(["reglages.modifier"]);
    expect(appels.reglages).toMatchObject([{ cle: "forfait_livraison_goma_cents", valeur: cents }]);
  });

  it.each(["-1", "abc", "5,555", "1001", "1 000"])("« %s » est refusé pour Goma, rien n'est écrit", async (saisie) => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "forfait_livraison_goma_cents", valeur: saisie })).toEqual({ ok: false, erreur: "forfait_goma_invalide" });
    expect(appels.reglages).toEqual([]);
    expect(deps.invalider).not.toHaveBeenCalled();
  });

  it("l'erreur de Bukavu porte son propre code", async () => {
    const { deps } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "forfait_livraison_bukavu_cents", valeur: "x" })).toEqual({ ok: false, erreur: "forfait_bukavu_invalide" });
  });

  it("vide : clé effacée (null)", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "forfait_livraison_bukavu_cents", valeur: "  " })).toEqual({ ok: true, valeur: null });
    expect(appels.reglages).toMatchObject([{ valeur: null }]);
  });

  it("la base refuse la valeur : code de la clé, cache intact", async () => {
    const { deps } = creerTestDependancesAdmin({ erreurEcriture: "KS_REGLAGE_INVALIDE" });
    expect(await enregistrerReglage(deps, { cle: "forfait_livraison_goma_cents", valeur: "5" })).toEqual({ ok: false, erreur: "forfait_goma_invalide" });
    expect(deps.invalider).not.toHaveBeenCalled();
  });

  it("Assistant : refus serveur, rien n'est écrit", async () => {
    const { deps, appels } = creerTestDependancesAdmin({ droit: "KS_DROIT_REFUSE" });
    expect(await enregistrerReglage(deps, { cle: "forfait_livraison_goma_cents", valeur: "5" })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(appels.reglages).toEqual([]);
  });
});

describe("enregistrerReglage : retrait à Goma et Plafond de fabrication", () => {
  it("retrait : texte rogné, écrit", async () => {
    const { deps } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "retrait_goma_fr", valeur: "  Texte de test  " })).toEqual({ ok: true, valeur: "Texte de test" });
    expect(await enregistrerReglage(deps, { cle: "retrait_goma_en", valeur: "x".repeat(500) })).toMatchObject({ ok: true });
  });

  it("retrait de plus de 500 caractères : refusé, un code par langue", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "retrait_goma_fr", valeur: "x".repeat(501) })).toEqual({ ok: false, erreur: "retrait_fr_invalide" });
    expect(await enregistrerReglage(deps, { cle: "retrait_goma_en", valeur: "x".repeat(501) })).toEqual({ ok: false, erreur: "retrait_en_invalide" });
    expect(appels.reglages).toEqual([]);
  });

  it("retrait démesuré (plus de 2000 caractères) : erreur de la clé, pas générique", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "retrait_goma_fr", valeur: "x".repeat(2001) })).toEqual({ ok: false, erreur: "retrait_fr_invalide" });
    expect(await enregistrerReglage(deps, { cle: "nom_site", valeur: "x".repeat(2001) })).toEqual({ ok: false, erreur: "nom_invalide" });
    expect(await enregistrerReglage(deps, { cle: "autre" as never, valeur: "x" })).toEqual({ ok: false, erreur: "generique" });
    expect(appels.reglages).toEqual([]);
  });

  it("retrait vide : effacé", async () => {
    const { deps } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "retrait_goma_fr", valeur: "   " })).toEqual({ ok: true, valeur: null });
  });

  it.each([
    ["40", "40"],
    ["1", "1"],
    ["10000", "10000"],
    [" 7 ", "7"],
  ])("Plafond « %s » accepté", async (saisie, attendu) => {
    const { deps } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "plafond_fabrication", valeur: saisie })).toEqual({ ok: true, valeur: attendu });
  });

  it.each(["0", "2,5", "2.5", "10001", "-3", "abc", "1e3"])("Plafond « %s » refusé", async (saisie) => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "plafond_fabrication", valeur: saisie })).toEqual({ ok: false, erreur: "plafond_invalide" });
    expect(appels.reglages).toEqual([]);
  });

  it("Plafond vide : effacé", async () => {
    const { deps } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "plafond_fabrication", valeur: "" })).toEqual({ ok: true, valeur: null });
  });
});

describe("Server Action enregistrerReglage : nouvelles clés", () => {
  function formulaire(valeurs: Record<string, string>) {
    const f = new FormData();
    for (const [cle, valeur] of Object.entries(valeurs)) f.set(cle, valeur);
    return f;
  }

  it("forfait : succès seulement après la réponse, valeur en centimes", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    faux.courant = deps;
    expect(await actionReglage(null, formulaire({ cle: "forfait_livraison_goma_cents", valeur: "5,50" }))).toEqual({ statut: "succes", cle: "forfait_livraison_goma_cents", valeur: "550" });
    expect(appels.ordre).toEqual(["droit", "ecriture", "invalidation"]);
  });

  it("forfait invalide : la saisie telle que tapée revient", async () => {
    faux.courant = creerTestDependancesAdmin().deps;
    expect(await actionReglage(null, formulaire({ cle: "forfait_livraison_goma_cents", valeur: "5,555" }))).toEqual({
      statut: "erreur",
      cle: "forfait_livraison_goma_cents",
      erreur: "forfait_goma_invalide",
      valeur: "5,555",
    });
  });

  it("échec de la base : erreur générique, pas de succès, saisie conservée", async () => {
    faux.courant = creerTestDependancesAdmin({ erreurEcriture: "boum" }).deps;
    expect(await actionReglage(null, formulaire({ cle: "plafond_fabrication", valeur: "40" }))).toEqual({ statut: "erreur", cle: "plafond_fabrication", erreur: "generique", valeur: "40" });
  });

  it("Compte simple ou Assistant : non_autorise", async () => {
    faux.courant = creerTestDependancesAdmin({ droit: "KS_DROIT_REFUSE" }).deps;
    expect(await actionReglage(null, formulaire({ cle: "retrait_goma_fr", valeur: "x" }))).toMatchObject({ statut: "erreur", erreur: "non_autorise" });
  });
});
