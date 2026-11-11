import { describe, expect, it, vi } from "vitest";
import { codeDeLaBase, creerCommandePass, lireRecapitulatifPass } from "@/modules/evenements/achat";
import { VERSION_PASS_PHOTOS } from "@/modules/evenements/achat-types";
import { creerTestDependancesAchat, TEST_EVENEMENT, TEST_RECAP, TEST_TYPE } from "../doubles/TEST_dependances-achat";

vi.mock("server-only", () => ({}));

const LIGNES = [{ typePassId: TEST_TYPE, titulaires: ["TEST_  Alice   Martin ", "TEST_Bob"] }];
const CREATION = { evenementId: TEST_EVENEMENT, lignes: LIGNES, pourMoi: false, mention: true as const, totalAttenduCents: 3000, cleIdempotence: "TEST_cle-0001" };

describe("lireRecapitulatifPass", () => {
  it("rend le Récapitulatif relu par la base, dans la langue", async () => {
    const { deps, appels } = creerTestDependancesAchat();
    const fr = await lireRecapitulatifPass(deps, { evenementId: TEST_EVENEMENT, lignes: LIGNES, pourMoi: false }, "fr");
    const en = await lireRecapitulatifPass(deps, { evenementId: TEST_EVENEMENT, lignes: LIGNES, pourMoi: false }, "en");
    expect(fr).toMatchObject({ ok: true, recap: { totalCents: 3000, personnes: 2, lignes: [{ nom: "TEST_Pass simple", prixCents: 1500, nombre: 2 }] } });
    expect(en).toMatchObject({ ok: true, recap: { lignes: [{ nom: "TEST_Simple pass" }] } });
    expect(appels.recaps).toHaveLength(2);
  });

  it("nettoie les noms avant de les envoyer à la base", async () => {
    const { deps, appels } = creerTestDependancesAchat();
    await lireRecapitulatifPass(deps, { evenementId: TEST_EVENEMENT, lignes: LIGNES, pourMoi: false }, "fr");
    expect(appels.recaps[0].lignes).toEqual([{ type_pass_id: TEST_TYPE, titulaires: ["TEST_ Alice Martin", "TEST_Bob"] }]);
  });

  it("le Pass de l'acheteur reprend le nom du Compte, jamais celui du navigateur", async () => {
    const { deps, appels } = creerTestDependancesAchat({ nomCompte: "TEST_Nom Du Compte" });
    await lireRecapitulatifPass(deps, { evenementId: TEST_EVENEMENT, lignes: LIGNES, pourMoi: true }, "fr");
    expect(appels.recaps[0].lignes[0].titulaires).toEqual(["TEST_Nom Du Compte", "TEST_Bob"]);
  });

  it("sans nom de Compte, le nom saisi est gardé : rien n'est inventé", async () => {
    const { deps, appels } = creerTestDependancesAchat({ nomCompte: null });
    await lireRecapitulatifPass(deps, { evenementId: TEST_EVENEMENT, lignes: LIGNES, pourMoi: true }, "fr");
    expect(appels.recaps[0].lignes[0].titulaires[0]).toBe("TEST_ Alice Martin");
  });

  it("entrée invalide : refus sans appel à la base", async () => {
    const { deps, appels } = creerTestDependancesAchat();
    expect(await lireRecapitulatifPass(deps, { evenementId: "pas-un-uuid", lignes: LIGNES, pourMoi: false }, "fr")).toEqual({ ok: false, erreur: "invalide" });
    expect(await lireRecapitulatifPass(deps, { evenementId: TEST_EVENEMENT, lignes: [], pourMoi: false }, "fr")).toEqual({ ok: false, erreur: "invalide" });
    expect(appels.recaps).toHaveLength(0);
  });

  it("session absente ou Compte incomplet : refus avant toute lecture", async () => {
    const a = creerTestDependancesAchat({ compte: "KS_NON_CONNECTE" });
    expect(await lireRecapitulatifPass(a.deps, { evenementId: TEST_EVENEMENT, lignes: LIGNES, pourMoi: false }, "fr")).toEqual({ ok: false, erreur: "non_connecte" });
    const b = creerTestDependancesAchat({ compte: "KS_COMPTE_INCOMPLET" });
    expect(await lireRecapitulatifPass(b.deps, { evenementId: TEST_EVENEMENT, lignes: LIGNES, pourMoi: false }, "fr")).toEqual({ ok: false, erreur: "compte_incomplet" });
    expect(a.appels.recaps.length + b.appels.recaps.length).toBe(0);
  });

  it("un Code promo refusé est rendu dans le Récapitulatif, jamais en erreur", async () => {
    const { deps } = creerTestDependancesAchat({ recap: { ...TEST_RECAP, code: { valide: false, erreur: "code_premier_achat" } } });
    const r = await lireRecapitulatifPass(deps, { evenementId: TEST_EVENEMENT, lignes: LIGNES, pourMoi: false, code: "TEST" }, "fr");
    expect(r).toMatchObject({ ok: true, recap: { code: { valide: false, erreur: "code_premier_achat" } } });
  });
});

describe("creerCommandePass", () => {
  it("crée la Commande avec la mention versionnée et le total vu, et rend son numéro", async () => {
    const { deps, appels } = creerTestDependancesAchat();
    const r = await creerCommandePass(deps, CREATION, "fr");
    expect(r).toEqual({ ok: true, numero: "KS-2099-000001", expireLe: "2099-01-01T00:00:00Z" });
    expect(appels.commandes).toHaveLength(1);
    expect(appels.commandes[0]).toMatchObject({
      evenementId: TEST_EVENEMENT,
      totalAttenduCents: 3000,
      cleIdempotence: "TEST_cle-0001",
      acceptations: [{ objet: "pass_photos_video", version: VERSION_PASS_PHOTOS }],
      code: null,
    });
  });

  it("sans la case de la mention : refus, aucune Commande", async () => {
    const { deps, appels } = creerTestDependancesAchat();
    // @ts-expect-error la mention doit être vraie : un faux est refusé par le schéma
    expect(await creerCommandePass(deps, { ...CREATION, mention: false }, "fr")).toEqual({ ok: false, erreur: "mention" });
    // @ts-expect-error la mention est absente
    expect(await creerCommandePass(deps, { ...CREATION, mention: undefined }, "fr")).toEqual({ ok: false, erreur: "mention" });
    expect(appels.commandes).toHaveLength(0);
  });

  it("session absente : refus, aucune Commande", async () => {
    const { deps, appels } = creerTestDependancesAchat({ compte: "KS_NON_CONNECTE" });
    expect(await creerCommandePass(deps, CREATION, "fr")).toEqual({ ok: false, erreur: "non_connecte" });
    expect(appels.commandes).toHaveLength(0);
  });

  it.each([
    ["KS_COMPLET", "complet"],
    ["KS_VENTE_FERMEE", "vente_fermee"],
    ["KS_STAND_SUR_CANDIDATURE", "stand"],
    ["KS_TITULAIRE_INVALIDE", "titulaire"],
    ["KS_ACCEPTATION_MANQUANTE", "mention"],
    ["KS_COMMANDE_EN_ATTENTE", "commande_en_attente"],
    ["KS_PASS_GRATUIT", "gratuit"],
    ["KS_EVENEMENT_INTROUVABLE", "evenement_introuvable"],
    ["KS_TYPE_PASS_INTROUVABLE", "type_introuvable"],
    ["KS_CODE_PREMIER_ACHAT", "code_premier_achat"],
    ["KS_REGLAGE_MANQUANT", "reglage_manquant"],
    ["23505", "erreur"],
  ])("refus de la base %s : %s", async (code, erreur) => {
    const { deps } = creerTestDependancesAchat({ erreurCommande: code });
    expect(await creerCommandePass(deps, CREATION, "fr")).toEqual({ ok: false, erreur });
  });

  it("total changé : rien n'est créé et le nouveau Récapitulatif est rendu", async () => {
    const { deps, appels } = creerTestDependancesAchat({ erreurCommande: "KS_TOTAL_CHANGE", recap: { ...TEST_RECAP, sous_total_cents: 3200, total_cents: 3200 } });
    const r = await creerCommandePass(deps, CREATION, "fr");
    expect(r).toMatchObject({ ok: false, erreur: "total_change", recap: { totalCents: 3200 } });
    expect(appels.commandes).toHaveLength(1);
    expect(appels.recaps).toHaveLength(1);
  });

  it("le nom du Compte remplace le premier nom quand « pour moi » est coché", async () => {
    const { deps, appels } = creerTestDependancesAchat({ nomCompte: "TEST_Nom Du Compte" });
    await creerCommandePass(deps, { ...CREATION, pourMoi: true }, "fr");
    expect(appels.commandes[0].lignes[0].titulaires).toEqual(["TEST_Nom Du Compte", "TEST_Bob"]);
  });

  it("une exception inattendue ne fait jamais annoncer un succès", async () => {
    const { deps } = creerTestDependancesAchat();
    deps.creerCommande = vi.fn(async () => {
      throw new Error("TEST_panne");
    });
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await creerCommandePass(deps, CREATION, "fr")).toEqual({ ok: false, erreur: "erreur" });
    // Le journal ne contient ni nom de titulaire ni identifiant.
    expect(JSON.stringify(erreur.mock.calls)).not.toContain("TEST_Bob");
    erreur.mockRestore();
  });

  it("la création ne reçoit aucun Panier : seuls l'Événement, les lignes de Pass et le total", async () => {
    const { deps, appels } = creerTestDependancesAchat();
    await creerCommandePass(deps, CREATION, "fr");
    expect(Object.keys(appels.commandes[0]).sort()).toEqual(["acceptations", "auteur", "cleIdempotence", "code", "evenementId", "lignes", "totalAttenduCents"]);
  });
});

describe("codeDeLaBase", () => {
  it("un message inconnu devient « erreur », jamais un détail de la base", () => {
    expect(codeDeLaBase("duplicate key value violates unique constraint")).toBe("erreur");
  });
});
