import { describe, expect, it, vi } from "vitest";
import { ajouterCouple, confirmerCouple, couplesConfirmes, retirerCouple, validerCouple, type CoupleCouverture, type DependancesCouverture } from "@/modules/paiement/couverture";
import { choisirPrestataire } from "@/modules/paiement/aiguillage";

const ID = "00000000-0000-4000-8000-0000000000c1";
const ENTREE = { prestataire: "pawapay", pays: "TZ", operateur: "TEST_operateur", source: "TEST document officiel, page 4" };

function deps(s: Partial<DependancesCouverture> = {}): DependancesCouverture {
  return {
    exigerDroit: vi.fn(async () => ({ auteur: "TEST_auteur" })),
    ajouter: vi.fn(async () => ({ erreur: null })),
    confirmer: vi.fn(async () => ({ erreur: null })),
    retirer: vi.fn(async () => ({ erreur: null })),
    ...s,
  };
}

describe("validerCouple : la source est obligatoire, chaque erreur nomme son champ", () => {
  it("sans source : refusé, avant tout autre contrôle", () => {
    expect(validerCouple({ ...ENTREE, source: "" })).toEqual({ ok: false, erreur: "source_manquante" });
    expect(validerCouple({ ...ENTREE, source: "   " })).toEqual({ ok: false, erreur: "source_manquante" });
    expect(validerCouple({ ...ENTREE, source: "", pays: "x" })).toEqual({ ok: false, erreur: "source_manquante" });
  });
  it("source trop courte ou trop longue", () => {
    expect(validerCouple({ ...ENTREE, source: "ab" })).toEqual({ ok: false, erreur: "source_invalide" });
    expect(validerCouple({ ...ENTREE, source: "a".repeat(301) })).toEqual({ ok: false, erreur: "source_invalide" });
  });
  it("pays : exactement deux lettres, mises en majuscules", () => {
    expect(validerCouple({ ...ENTREE, pays: "tz" })).toMatchObject({ ok: true, couple: { pays: "TZ" } });
    for (const pays of ["", "T", "TZA", "T1", "É"]) expect(validerCouple({ ...ENTREE, pays })).toEqual({ ok: false, erreur: "pays_invalide" });
  });
  it("opérateur : de 1 à 40 caractères", () => {
    expect(validerCouple({ ...ENTREE, operateur: "  " })).toEqual({ ok: false, erreur: "operateur_invalide" });
    expect(validerCouple({ ...ENTREE, operateur: "a".repeat(41) })).toEqual({ ok: false, erreur: "operateur_invalide" });
  });
  it("seuls les Agrégateurs ont une Couverture : Polar et un code inconnu sont refusés", () => {
    for (const prestataire of ["polar", "geniuspay", ""]) expect(validerCouple({ ...ENTREE, prestataire })).toEqual({ ok: false, erreur: "agregateur_invalide" });
  });
});

describe("ajouterCouple, confirmerCouple, retirerCouple", () => {
  it("ajoute un couple valide avec le droit de l'Admin, valeurs nettoyées", async () => {
    const d = deps();
    await expect(ajouterCouple(d, { ...ENTREE, pays: " tz ", operateur: " TEST_operateur ", source: "  TEST source  " })).resolves.toEqual({ ok: true });
    expect(d.ajouter).toHaveBeenCalledWith("TEST_auteur", { prestataire: "pawapay", pays: "TZ", operateur: "TEST_operateur", source: "TEST source" });
  });
  it("sans source : refus, la base n'est pas appelée", async () => {
    const d = deps();
    await expect(ajouterCouple(d, { ...ENTREE, source: "" })).resolves.toEqual({ ok: false, erreur: "source_manquante" });
    expect(d.exigerDroit).not.toHaveBeenCalled();
    expect(d.ajouter).not.toHaveBeenCalled();
  });
  it("sans droit : refus, rien d'écrit", async () => {
    const d = deps({ exigerDroit: vi.fn(async () => Promise.reject(new Error("KS_DROIT_REFUSE"))) });
    await expect(ajouterCouple(d, ENTREE)).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    await expect(confirmerCouple(d, ID)).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    await expect(retirerCouple(d, ID)).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    expect(d.ajouter).not.toHaveBeenCalled();
    expect(d.confirmer).not.toHaveBeenCalled();
    expect(d.retirer).not.toHaveBeenCalled();
  });
  it("couple déjà saisi : erreur reliée au champ opérateur", async () => {
    const d = deps({ ajouter: vi.fn(async () => ({ erreur: "KS_COUPLE_EXISTANT" })) });
    await expect(ajouterCouple(d, ENTREE)).resolves.toEqual({ ok: false, erreur: "couple_existant" });
  });
  it("confirmer et retirer : identifiant invalide ou inconnu refusé", async () => {
    const d = deps({ confirmer: vi.fn(async () => ({ erreur: "KS_COUVERTURE_INTROUVABLE" })) });
    await expect(confirmerCouple(d, "pas-un-uuid")).resolves.toEqual({ ok: false, erreur: "introuvable" });
    expect(d.confirmer).not.toHaveBeenCalled();
    await expect(confirmerCouple(d, ID)).resolves.toEqual({ ok: false, erreur: "introuvable" });
  });
  it("confirmer et retirer réussissent avec l'auteur de la session", async () => {
    const d = deps();
    await expect(confirmerCouple(d, ID)).resolves.toEqual({ ok: true });
    await expect(retirerCouple(d, ID)).resolves.toEqual({ ok: true });
    expect(d.confirmer).toHaveBeenCalledWith("TEST_auteur", ID);
    expect(d.retirer).toHaveBeenCalledWith("TEST_auteur", ID);
  });
  it("exception inattendue : erreur générique, journal sans donnée", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps({ ajouter: vi.fn(async () => Promise.reject(new Error("TEST_secret"))) });
    await expect(ajouterCouple(d, ENTREE)).resolves.toEqual({ ok: false, erreur: "generique" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("TEST_secret");
    spy.mockRestore();
  });
});

describe("Couverture et aiguilleur : seul un couple confirmé d'un Agrégateur actif sert au paiement", () => {
  const couples: CoupleCouverture[] = [
    { id: "1", prestataire: "pawapay", pays: "TZ", operateur: "TEST_a", source: "TEST", etat: "a_verifier" },
    { id: "2", prestataire: "kpay", pays: "TZ", operateur: "TEST_a", source: "TEST", etat: "confirme" },
  ];
  const entree = (couverture: ReturnType<typeof couplesConfirmes>, actifs: Array<"pawapay" | "kpay">) => ({
    achat: { familles: ["cosplay" as const], estPass: false },
    moyen: "mobile_money" as const,
    pays: "TZ",
    operateur: "TEST_a",
    prestatairesActifs: actifs,
    couverture,
    ordre: ["pawapay", "kpay"] as Array<"pawapay" | "kpay">,
    exclus: [],
  });
  it("un couple « à vérifier » n'est jamais retenu", () => {
    expect(couplesConfirmes(couples)).toEqual([{ prestataire: "kpay", pays: "TZ", operateur: "TEST_a" }]);
  });
  it("PawaPay (à vérifier) est ignoré même en tête de l'ordre : K-Pay, confirmé et actif, est choisi", () => {
    expect(choisirPrestataire(entree(couplesConfirmes(couples), ["pawapay", "kpay"]))).toEqual({ statut: "ok", prestataire: "kpay" });
  });
  it("Agrégateur désactivé : son couple confirmé ne sert pas", () => {
    expect(choisirPrestataire(entree(couplesConfirmes(couples), ["pawapay"]))).toEqual({ statut: "indisponible", raison: "mobile_money_indisponible" });
  });
  it("aucune ligne saisie : aucun mobile money", () => {
    expect(choisirPrestataire(entree([], ["pawapay", "kpay"])).statut).toBe("indisponible");
  });
});
