import { describe, expect, it, vi } from "vitest";
import { appliquerResultat, reconcilier, traiterNotification, type DependancesConfirmation, type TentativeLue } from "@/modules/paiement/confirmation";
import type { CodePrestataire, ComparaisonMontant, PrestatairePaiement, RequeteNotification, ResultatAdaptateur } from "@/modules/paiement/types";
import { creerPrestataireTest } from "../doubles/TEST_prestataire";

const TENTATIVE: TentativeLue = {
  id: "TEST_tentative",
  prestataire: "pawapay",
  statut: "en_cours",
  referenceInterne: "TEST-REF-1",
  referenceTransaction: "TEST-TX-1",
  montantAttenduCents: 1500,
  commandeNumero: "KS-2026-000042",
};
const SUCCES: ResultatAdaptateur = { statut: "succes", referenceTransaction: "TEST-TX-1", montantRecu: "15", deviseRecue: "USD" };
const REQUETE: RequeteNotification = { methode: "POST", en_tetes: {}, corps: "{}", requete: "" };

function deps(s: Partial<DependancesConfirmation> = {}, adaptateurs: Partial<Record<CodePrestataire, PrestatairePaiement>> = {}): DependancesConfirmation {
  return {
    adaptateur: vi.fn((code: CodePrestataire) => adaptateurs[code] ?? null),
    tentativeParReference: vi.fn(async () => TENTATIVE),
    enregistrerNotification: vi.fn(async () => true),
    confirmer: vi.fn(async () => ({ resultat: "payee" })),
    echouer: vi.fn(async () => undefined),
    toucher: vi.fn(async () => undefined),
    signalerIndetermine: vi.fn(async () => undefined),
    abandonnerPerimees: vi.fn(async () => 0),
    lot: vi.fn(async () => []),
    ...s,
  };
}
const test = (s: Parameters<typeof creerPrestataireTest>[0]) => creerPrestataireTest(s);

describe("appliquerResultat (règle 2 : seule une confirmation fiable avec le bon montant valide)", () => {
  it("succès + comparaison « égal » : confirmer_paiement est appelé avec le montant et la devise reçus", async () => {
    const d = deps();
    const v = await appliquerResultat(d, TENTATIVE, test({ code: "pawapay", comparaison: "egal" }), SUCCES);
    expect(v).toBe("payee");
    expect(d.confirmer).toHaveBeenCalledWith("TEST_tentative", "egal", 15, "USD", "TEST-TX-1");
  });
  it("comparaison « inférieur » ou « supérieur » : transmise telle quelle, la base décide (anomalie ou trop-perçu)", async () => {
    for (const c of ["inferieur", "superieur"] as ComparaisonMontant[]) {
      const d = deps({ confirmer: vi.fn(async () => ({ resultat: c === "inferieur" ? "montant_insuffisant" : "trop_percu" })) });
      await appliquerResultat(d, TENTATIVE, test({ code: "pawapay", comparaison: c }), SUCCES);
      expect(d.confirmer).toHaveBeenCalledWith("TEST_tentative", c, 15, "USD", "TEST-TX-1");
    }
  });
  it("comparaison « indéterminée » : rien n'est validé, l'admin est prévenu", async () => {
    const d = deps();
    const v = await appliquerResultat(d, TENTATIVE, test({ code: "pawapay", comparaison: "indetermine" }), SUCCES);
    expect(v).toBe("indetermine");
    expect(d.confirmer).not.toHaveBeenCalled();
    expect(d.signalerIndetermine).toHaveBeenCalledWith("TEST_tentative", 15, "USD");
  });
  it("succès sans montant ou sans devise lisible : rien n'est validé", async () => {
    for (const r of [{ ...SUCCES, montantRecu: null }, { ...SUCCES, deviseRecue: null }, { ...SUCCES, montantRecu: "abc" }, { ...SUCCES, deviseRecue: "usd" }]) {
      const d = deps();
      expect(await appliquerResultat(d, TENTATIVE, test({ code: "pawapay", comparaison: "egal" }), r)).toBe("indetermine");
      expect(d.confirmer).not.toHaveBeenCalled();
    }
  });
  it("aucune référence de transaction (ni reçue ni enregistrée) : rien n'est validé (règle 2)", async () => {
    const d = deps();
    const v = await appliquerResultat(d, { ...TENTATIVE, referenceTransaction: null }, test({ code: "pawapay", comparaison: "egal" }), { ...SUCCES, referenceTransaction: null });
    expect(v).toBe("indetermine");
    expect(d.confirmer).not.toHaveBeenCalled();
  });
  it("la référence reçue est transmise à la base, qui la compare à celle de la Tentative", async () => {
    const d = deps();
    await appliquerResultat(d, { ...TENTATIVE, referenceTransaction: null }, test({ code: "pawapay", comparaison: "egal" }), { ...SUCCES, referenceTransaction: "TX-RECUE" });
    expect(d.confirmer).toHaveBeenCalledWith("TEST_tentative", "egal", 15, "USD", "TX-RECUE");
  });
  it("référence incohérente refusée par la base : verdict « erreur », la Tentative passe en queue du lot", async () => {
    const d = deps({ confirmer: vi.fn(async () => ({ resultat: "reference_incoherente" })) });
    expect(await appliquerResultat(d, TENTATIVE, test({ code: "pawapay", comparaison: "egal" }), SUCCES)).toBe("erreur");
  });
  it("résultat « inconnu » : la Tentative reste en cours, rien n'est validé ni échoué", async () => {
    const d = deps();
    const v = await appliquerResultat(d, TENTATIVE, test({ code: "pawapay" }), { statut: "inconnu", referenceTransaction: null, montantRecu: null, deviseRecue: null });
    expect(v).toBe("inconnu");
    expect(d.confirmer).not.toHaveBeenCalled();
    expect(d.echouer).not.toHaveBeenCalled();
  });
  it("échec confirmé : la Tentative échoue avec sa cause (client ou Prestataire)", async () => {
    const vide = { referenceTransaction: null, montantRecu: null, deviseRecue: null };
    const d1 = deps();
    await appliquerResultat(d1, TENTATIVE, test({ code: "pawapay" }), { statut: "echec_client", ...vide });
    expect(d1.echouer).toHaveBeenCalledWith("TEST_tentative", "client");
    const d2 = deps();
    await appliquerResultat(d2, TENTATIVE, test({ code: "pawapay" }), { statut: "echec_prestataire", ...vide });
    expect(d2.echouer).toHaveBeenCalledWith("TEST_tentative", "prestataire");
  });
  it("échec d'une Tentative qui n'est plus en cours : aucun changement", async () => {
    const d = deps();
    await appliquerResultat(d, { ...TENTATIVE, statut: "abandonnee" }, test({ code: "pawapay" }), { statut: "echec_client", referenceTransaction: null, montantRecu: null, deviseRecue: null });
    expect(d.echouer).not.toHaveBeenCalled();
  });
  it("erreur de la base : verdict « erreur », jamais une exception", async () => {
    const d = deps({ confirmer: vi.fn(async () => ({ erreur: "KS_TENTATIVE_INTROUVABLE" })) });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await appliquerResultat(d, TENTATIVE, test({ code: "pawapay", comparaison: "egal" }), SUCCES)).toBe("erreur");
  });
});

describe("traiterNotification", () => {
  const verifiee = { idNotification: "TEST-NOTIF-1", referenceInterne: "TEST-REF-1", resultat: SUCCES };

  it("Prestataire sans adaptateur : 404, rien n'est enregistré", async () => {
    const d = deps();
    expect(await traiterNotification(d, "pawapay", REQUETE)).toEqual({ code: 404 });
    expect(d.enregistrerNotification).not.toHaveBeenCalled();
  });
  it("vérification échouée : 401, rien n'est enregistré ni validé", async () => {
    const d = deps({}, { pawapay: test({ code: "pawapay", notification: null, comparaison: "egal" }) });
    expect(await traiterNotification(d, "pawapay", REQUETE)).toEqual({ code: 401 });
    expect(d.enregistrerNotification).not.toHaveBeenCalled();
    expect(d.confirmer).not.toHaveBeenCalled();
  });
  it("la base refuse la confirmation (panne) : 500 pour que le Prestataire rejoue", async () => {
    const d = deps({ confirmer: vi.fn(async () => ({ erreur: "base" })) }, { pawapay: test({ code: "pawapay", notification: verifiee, comparaison: "egal" }) });
    expect(await traiterNotification(d, "pawapay", REQUETE)).toEqual({ code: 500 });
  });
  it("notification vérifiée : enregistrée, puis appliquée ; 200 avec le numéro de la Commande", async () => {
    const d = deps({}, { pawapay: test({ code: "pawapay", notification: verifiee, comparaison: "egal" }) });
    expect(await traiterNotification(d, "pawapay", REQUETE)).toEqual({ code: 200, numero: "KS-2026-000042" });
    expect(d.enregistrerNotification).toHaveBeenCalledWith("pawapay", "TEST-NOTIF-1", "TEST_tentative", true);
    expect(d.confirmer).toHaveBeenCalledTimes(1);
  });
  it("notification qui ne correspond à aucune Tentative : 200, enregistrée, rien n'est validé", async () => {
    const d = deps({ tentativeParReference: vi.fn(async () => null) }, { pawapay: test({ code: "pawapay", notification: verifiee, comparaison: "egal" }) });
    expect(await traiterNotification(d, "pawapay", REQUETE)).toEqual({ code: 200, numero: null });
    expect(d.confirmer).not.toHaveBeenCalled();
  });
  it("Tentative d'un autre Prestataire : ignorée (une notification de l'un ne valide pas le paiement de l'autre)", async () => {
    const d = deps({ tentativeParReference: vi.fn(async () => ({ ...TENTATIVE, prestataire: "maishapay" as const })) }, { pawapay: test({ code: "pawapay", notification: verifiee, comparaison: "egal" }) });
    expect(await traiterNotification(d, "pawapay", REQUETE)).toEqual({ code: 200, numero: null });
    expect(d.confirmer).not.toHaveBeenCalled();
  });
  it("notification rejouée : le traitement reste sans effet double (confirmer_paiement renvoie « déjà traité »)", async () => {
    const d = deps({ enregistrerNotification: vi.fn(async () => false), confirmer: vi.fn(async () => ({ resultat: "deja_traite" })) }, { pawapay: test({ code: "pawapay", notification: verifiee, comparaison: "egal" }) });
    expect(await traiterNotification(d, "pawapay", REQUETE)).toEqual({ code: 200, numero: "KS-2026-000042" });
  });
  it("exception de l'adaptateur : 500, jamais une validation", async () => {
    const mauvais = { ...test({ code: "pawapay" }), verifierNotification: async () => { throw new Error("réseau"); } };
    const d = deps({}, { pawapay: mauvais });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await traiterNotification(d, "pawapay", REQUETE)).toEqual({ code: 500 });
    expect(d.confirmer).not.toHaveBeenCalled();
  });
});

describe("reconcilier", () => {
  it("interroge chaque Tentative du lot par ses deux références et applique le résultat", async () => {
    const adaptateur = test({ code: "pawapay", statut: SUCCES, comparaison: "egal" });
    const consulter = vi.spyOn(adaptateur, "consulterStatut");
    const d = deps({ lot: vi.fn(async () => [TENTATIVE]), abandonnerPerimees: vi.fn(async () => 2) }, { pawapay: adaptateur });
    const bilan = await reconcilier(d);
    expect(consulter).toHaveBeenCalledWith({ referenceInterne: "TEST-REF-1", referenceTransaction: "TEST-TX-1" });
    expect(bilan).toMatchObject({ abandonnees: 2, interrogees: 1, payees: 1, erreurs: 0 });
  });
  it("Prestataire sans adaptateur : ignoré, rien n'est interrogé", async () => {
    const d = deps({ lot: vi.fn(async () => [TENTATIVE]) });
    expect(await reconcilier(d)).toMatchObject({ ignorees: 1, interrogees: 0 });
  });
  it("un appel qui échoue laisse la Tentative en cours (AD-28) et passe à la suivante", async () => {
    const mauvais = { ...test({ code: "pawapay" }), consulterStatut: async () => { throw new Error("délai"); } };
    const d = deps({ lot: vi.fn(async () => [TENTATIVE, { ...TENTATIVE, id: "TEST_t2" }]) }, { pawapay: mauvais });
    const bilan = await reconcilier(d);
    expect(bilan).toMatchObject({ interrogees: 2, erreurs: 2 });
    expect(d.echouer).not.toHaveBeenCalled();
    expect(d.confirmer).not.toHaveBeenCalled();
  });
  it("un succès tardif d'une Tentative abandonnée est transmis à confirmer_paiement (trop-perçu décidé par la base)", async () => {
    const adaptateur = test({ code: "pawapay", statut: SUCCES, comparaison: "egal" });
    const d = deps({ lot: vi.fn(async () => [{ ...TENTATIVE, statut: "abandonnee" }]), confirmer: vi.fn(async () => ({ resultat: "trop_percu" })) }, { pawapay: adaptateur });
    expect(await reconcilier(d)).toMatchObject({ payees: 1 });
    expect(d.confirmer).toHaveBeenCalledTimes(1);
  });
  it("lot illisible : une erreur, aucun appel à un Prestataire", async () => {
    const d = deps({ lot: vi.fn(async () => { throw new Error("base"); }) });
    expect(await reconcilier(d)).toMatchObject({ erreurs: 1, interrogees: 0 });
  });
});
