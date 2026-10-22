import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { corrigerAgeParAdmin, enregistrerReglage } from "@/modules/admin/service";
import { creerTestDependancesAdmin, TEST_ADMIN_ID } from "../doubles/TEST_dependances-admin";

const COMPTE = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("enregistrerReglage", () => {
  it("numéro valide : espaces retirés, écriture, puis invalidation du cache, dans cet ordre", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    const r = await enregistrerReglage(deps, { cle: "numero_whatsapp", valeur: "+243 970 000 000" });
    expect(r).toEqual({ ok: true, valeur: "+243970000000" });
    expect(appels.ordre).toEqual(["droit", "ecriture", "invalidation"]);
    expect(appels.droits).toEqual(["reglages.modifier"]);
    expect(appels.reglages).toEqual([{ auteur: { type: "compte", id: TEST_ADMIN_ID, role: "admin" }, cle: "numero_whatsapp", valeur: "+243970000000" }]);
  });

  it("numéro vide : effacé (null)", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "numero_whatsapp", valeur: "   " })).toEqual({ ok: true, valeur: null });
    expect(appels.reglages).toMatchObject([{ valeur: null }]);
  });

  it("nom valide : rogné", async () => {
    const { deps } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "nom_site", valeur: "  Mon site  " })).toEqual({ ok: true, valeur: "Mon site" });
  });

  it.each(["abc", "970000000", "+12", "+1234567890123456", "+243 97a 000 000"])("numéro invalide « %s » : refusé, rien n'est écrit", async (valeur) => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "numero_whatsapp", valeur })).toEqual({ ok: false, erreur: "numero_invalide" });
    expect(appels.reglages).toEqual([]);
    expect(deps.invalider).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "x".repeat(61)])("nom invalide (%#) : refusé, rien n'est écrit", async (valeur) => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "nom_site", valeur })).toEqual({ ok: false, erreur: "nom_invalide" });
    expect(appels.reglages).toEqual([]);
  });

  it("nom de 60 caractères : accepté", async () => {
    const { deps } = creerTestDependancesAdmin();
    expect((await enregistrerReglage(deps, { cle: "nom_site", valeur: "x".repeat(60) })).ok).toBe(true);
  });

  it("clé inconnue : refusée avant toute écriture", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "autre" as never, valeur: "x" })).toEqual({ ok: false, erreur: "generique" });
    expect(appels.reglages).toEqual([]);
  });

  it("droit refusé : le droit passe avant tout, rien n'est écrit ni invalidé", async () => {
    for (const droit of ["KS_NON_CONNECTE", "KS_DROIT_REFUSE"] as const) {
      const { deps, appels } = creerTestDependancesAdmin({ droit });
      expect(await enregistrerReglage(deps, { cle: "nom_site", valeur: "x" })).toEqual({ ok: false, erreur: "non_autorise" });
      expect(appels.ordre).toEqual(["droit"]);
    }
  });

  it("vérification du droit impossible : erreur générique, rien n'est écrit", async () => {
    const { deps, appels } = creerTestDependancesAdmin({ droit: "KS_VERIFICATION_IMPOSSIBLE" });
    expect(await enregistrerReglage(deps, { cle: "nom_site", valeur: "x" })).toEqual({ ok: false, erreur: "generique" });
    expect(appels.reglages).toEqual([]);
  });

  it("la base refuse (droit perdu) : non autorisé, cache intact", async () => {
    const { deps } = creerTestDependancesAdmin({ erreurEcriture: "KS_DROIT_REFUSE" });
    expect(await enregistrerReglage(deps, { cle: "nom_site", valeur: "x" })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(deps.invalider).not.toHaveBeenCalled();
  });

  it("la base refuse la valeur : erreur de champ, cache intact", async () => {
    const { deps } = creerTestDependancesAdmin({ erreurEcriture: "KS_REGLAGE_INVALIDE" });
    expect(await enregistrerReglage(deps, { cle: "numero_whatsapp", valeur: "+243970000000" })).toEqual({ ok: false, erreur: "numero_invalide" });
    expect(deps.invalider).not.toHaveBeenCalled();
  });

  it("échec serveur : erreur générique, aucune réussite, le journal n'écrit ni la valeur ni l'identifiant", async () => {
    const { deps } = creerTestDependancesAdmin({ erreurEcriture: "connexion perdue vers +243970000000" });
    expect(await enregistrerReglage(deps, { cle: "numero_whatsapp", valeur: "+243970000000" })).toEqual({ ok: false, erreur: "generique" });
    expect(deps.invalider).not.toHaveBeenCalled();
    const journal = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(journal).not.toContain("243970000000");
    expect(journal).not.toContain(TEST_ADMIN_ID);
  });
});

describe("corrigerAgeParAdmin", () => {
  const entree = { compteId: COMPTE, age: 25, raison: "Erreur de saisie" };

  it("correction normale : droit age.corriger, aucune suppression", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await corrigerAgeParAdmin(deps, entree)).toEqual({ ok: true, compteSupprime: false });
    expect(appels.droits).toEqual(["age.corriger"]);
    expect(appels.ages).toEqual([{ auteur: { type: "compte", id: TEST_ADMIN_ID, role: "admin" }, compteId: COMPTE, age: 25, raison: "Erreur de saisie" }]);
    expect(appels.suppressions).toEqual([]);
  });

  it("sous 13 ans : la base journalise, puis le service supprime le Compte", async () => {
    const { deps, appels } = creerTestDependancesAdmin({ supprimer: true });
    expect(await corrigerAgeParAdmin(deps, { ...entree, age: 12 })).toEqual({ ok: true, compteSupprime: true });
    expect(appels.ordre).toEqual(["droit", "age", "suppression"]);
    expect(appels.suppressions).toEqual([COMPTE]);
  });

  it("sous 13 ans, suppression impossible : erreur, pas de succès", async () => {
    const { deps } = creerTestDependancesAdmin({ supprimer: true, suppressionEchoue: true });
    expect(await corrigerAgeParAdmin(deps, { ...entree, age: 12 })).toEqual({ ok: false, erreur: "suppression_echouee" });
  });

  it("raison trop courte ou absente : refusée avant la base", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await corrigerAgeParAdmin(deps, { ...entree, raison: "ab" })).toEqual({ ok: false, erreur: "raison_manquante" });
    expect(await corrigerAgeParAdmin(deps, { ...entree, raison: "   " })).toEqual({ ok: false, erreur: "raison_manquante" });
    expect(appels.ages).toEqual([]);
  });

  it("âge hors de 0 à 120 : refusé", async () => {
    const { deps } = creerTestDependancesAdmin();
    expect(await corrigerAgeParAdmin(deps, { ...entree, age: 121 })).toEqual({ ok: false, erreur: "age_invalide" });
    expect(await corrigerAgeParAdmin(deps, { ...entree, age: -1 })).toEqual({ ok: false, erreur: "age_invalide" });
  });

  it("droit refusé : rien n'est modifié", async () => {
    const { deps, appels } = creerTestDependancesAdmin({ droit: "KS_DROIT_REFUSE" });
    expect(await corrigerAgeParAdmin(deps, entree)).toEqual({ ok: false, erreur: "non_autorise" });
    expect(appels.ages).toEqual([]);
  });

  it("erreurs de la base : codes d'interface sans donnée personnelle", async () => {
    expect(await corrigerAgeParAdmin(creerTestDependancesAdmin({ erreurAge: "KS_AGE_NON_DECLARE" }).deps, entree)).toEqual({ ok: false, erreur: "age_non_declare" });
    expect(await corrigerAgeParAdmin(creerTestDependancesAdmin({ erreurAge: "KS_RAISON_MANQUANTE" }).deps, entree)).toEqual({ ok: false, erreur: "raison_manquante" });
    expect(await corrigerAgeParAdmin(creerTestDependancesAdmin({ erreurAge: "KS_DROIT_REFUSE" }).deps, entree)).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await corrigerAgeParAdmin(creerTestDependancesAdmin({ erreurAge: "autre" }).deps, entree)).toEqual({ ok: false, erreur: "generique" });
  });
});
