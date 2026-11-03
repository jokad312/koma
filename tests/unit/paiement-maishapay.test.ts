import { describe, expect, it, vi } from "vitest";
import { creerAdaptateurMaishaPay, providerMobileMoney, QUESTIONS_OUVERTES, type ConfigMaishaPay } from "@/modules/paiement/adaptateurs/maishapay";
import type { DonneesTentative } from "@/modules/paiement/types";

const CONFIG: ConfigMaishaPay = { clePublique: "TEST_PUBLIQUE", cleSecrete: "TEST_SECRETE", mode: 0 };
const REF = "KS-2026-000042-aabbccddeeff";

function reponse(json: unknown, http = 200): Response {
  return new Response(typeof json === "string" ? json : JSON.stringify(json), { status: http, headers: { "Content-Type": "application/json" } });
}
function faux(...reponses: Array<Response | Error>) {
  const f = vi.fn(async () => {
    const r = reponses.shift();
    if (!r) throw new Error("appel inattendu");
    if (r instanceof Error) throw r;
    return r;
  });
  return f as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- corps JSON de test, forme libre
const corps = (f: ReturnType<typeof vi.fn>, n = 0) => JSON.parse((f.mock.calls[n][1] as RequestInit).body as string) as Record<string, any>;

const MM: DonneesTentative = {
  referenceInterne: REF,
  montantAttenduCents: 1500,
  moyen: "mobile_money",
  pays: "CD",
  operateur: "Airtel Money",
  contact: { telephone: "+243990000000", email: "TEST@example.invalid", nom: null },
  reseauCarte: null,
  adresseRetour: "https://TEST.invalid/retour",
  adresseNotification: "https://TEST.invalid/api/paiement/notification/maishapay",
};
const CARTE: DonneesTentative = { ...MM, moyen: "carte", pays: null, operateur: null, contact: { telephone: "+243990000000", email: "TEST@example.invalid", nom: "Test Payeur" }, reseauCarte: "MASTERCARD" };
const ATTENTE = { status_code: 202, transactionStatus: "PENDING", transactionId: 12345, originatingTransactionId: REF };
const verifie = (statut: string, extra: Record<string, unknown> = {}) => ({
  transaction_type: "C2B | Collect",
  status_code: 200,
  transactionStatus: statut,
  transactionId: 12345,
  originatingTransactionId: REF,
  order: { cost: { amount: 15, frais: 0.45, total: 15.45, currency: "USD" } },
  ...extra,
});

describe("MaishaPay : questions ouvertes (règle 15)", () => {
  it("l'adaptateur n'est pas activable : des questions restent ouvertes, même avec les clés", () => {
    const a = creerAdaptateurMaishaPay(() => CONFIG, faux());
    expect(a.questionsOuvertes).toEqual(QUESTIONS_OUVERTES);
    expect(a.questionsOuvertes.length).toBeGreaterThan(0);
  });
  it("sans clés dans l'environnement, la première raison l'indique", () => {
    const a = creerAdaptateurMaishaPay(() => null, faux());
    expect(a.questionsOuvertes[0]).toMatch(/Clés/);
  });
  it("comparaison : « amount » en USD contre le montant attendu (frais absorbés par le site) ; toute autre devise ou forme reste indéterminée", () => {
    const a = creerAdaptateurMaishaPay(() => CONFIG, faux());
    expect(a.comparerMontant(1500, "15", "USD")).toBe("egal");
    expect(a.comparerMontant(1500, "15.00", "usd")).toBe("egal");
    expect(a.comparerMontant(1500, "14.99", "USD")).toBe("inferieur");
    expect(a.comparerMontant(1500, "15.45", "USD")).toBe("superieur");
    expect(a.comparerMontant(1500, "15", "CDF")).toBe("indetermine");
    expect(a.comparerMontant(1500, "quinze", "USD")).toBe("indetermine");
    expect(a.comparerMontant(1500, "-15", "USD")).toBe("indetermine");
  });
});

describe("providerMobileMoney", () => {
  it("seuls les opérateurs documentés pour la version 2 sont reconnus", () => {
    expect(providerMobileMoney("Airtel Money")).toBe("AIRTEL");
    expect(providerMobileMoney("Orange Money")).toBe("ORANGE");
    expect(providerMobileMoney("MTN")).toBe("MTN");
    expect(providerMobileMoney("M-Pesa")).toBeNull();
    expect(providerMobileMoney("Wave")).toBeNull();
    expect(providerMobileMoney(null)).toBeNull();
  });
});

describe("MaishaPay : initier", () => {
  it("mobile money : appelle la collecte v2 avec les clés en corps, le montant en USD et notre adresse de notification", async () => {
    const f = faux(reponse(ATTENTE, 202));
    const r = await creerAdaptateurMaishaPay(() => CONFIG, f).initier(MM);
    expect(r).toEqual({ statut: "initie", referenceTransaction: "12345", redirection: null });
    expect(f.mock.calls[0][0]).toBe("https://marchand.maishapay.online/api/collect/v2/store/mobileMoney");
    expect(corps(f)).toEqual({
      transactionReference: REF,
      gatewayMode: 0,
      publicApiKey: "TEST_PUBLIQUE",
      secretApiKey: "TEST_SECRETE",
      order: { amount: "15.00", currency: "USD", customerEmailAdress: "TEST@example.invalid" },
      paymentChannel: { channel: "MOBILEMONEY", provider: "AIRTEL", walletID: "+243990000000", callbackUrl: "https://TEST.invalid/api/paiement/notification/maishapay" },
    });
  });
  it("chaque appel porte un délai maximal", async () => {
    const f = faux(reponse(ATTENTE, 202));
    await creerAdaptateurMaishaPay(() => CONFIG, f).initier(MM);
    expect((f.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });
  it("opérateur non documenté en v2 (M-Pesa) : aucun appel, un autre Agrégateur peut être proposé", async () => {
    const f = faux();
    const r = await creerAdaptateurMaishaPay(() => CONFIG, f).initier({ ...MM, operateur: "M-Pesa" });
    expect(r).toEqual({ statut: "refuse", cause: "prestataire" });
    expect(f).not.toHaveBeenCalled();
  });
  it("refus explicite (FAILED, 400) : refus côté Prestataire", async () => {
    const f = faux(reponse({ status_code: 400, transactionStatus: "FAILED" }, 400));
    expect(await creerAdaptateurMaishaPay(() => CONFIG, f).initier(MM)).toEqual({ statut: "refuse", cause: "prestataire" });
  });
  it("réponse illisible, 500 ou coupure : exception, la Tentative reste en cours (jamais un échec inventé)", async () => {
    for (const f of [faux(reponse("pas du json", 502)), faux(reponse({}, 500)), faux(new Error("délai"))]) {
      await expect(creerAdaptateurMaishaPay(() => CONFIG, f).initier(MM)).rejects.toThrow();
    }
  });
  it("sans clés : exception, aucun appel", async () => {
    const f = faux();
    await expect(creerAdaptateurMaishaPay(() => null, f).initier(MM)).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
  it("carte : appelle la carte v2 et renvoie la page de paiement", async () => {
    const f = faux(reponse({ ...ATTENTE, paymentPage: "https://marchand.maishapay.online/api/collect/postRedirectionRequest/12345" }, 202));
    const r = await creerAdaptateurMaishaPay(() => CONFIG, f).initier(CARTE);
    expect(r).toEqual({ statut: "initie", referenceTransaction: "12345", redirection: "https://marchand.maishapay.online/api/collect/postRedirectionRequest/12345" });
    expect(f.mock.calls[0][0]).toBe("https://marchand.maishapay.online/api/collect/v2/store/card");
    expect(corps(f).paymentChannel.channel).toBe("CARD");
    expect(corps(f).order).toMatchObject({ amount: "15.00", currency: "USD", customerFullName: "Test Payeur", customerPhoneNumber: "+243990000000" });
  });
  it("carte : le réseau choisi par le client (Visa ou Mastercard) est celui qui part", async () => {
    for (const reseau of ["VISA", "MASTERCARD"] as const) {
      const f = faux(reponse({ ...ATTENTE, paymentPage: "https://pay.example.invalid/x" }, 202));
      await creerAdaptateurMaishaPay(() => CONFIG, f).initier({ ...CARTE, reseauCarte: reseau });
      expect(corps(f).paymentChannel.provider).toBe(reseau);
    }
  });
  it("carte sans réseau : aucun appel", async () => {
    const f = faux();
    expect(await creerAdaptateurMaishaPay(() => CONFIG, f).initier({ ...CARTE, reseauCarte: null })).toEqual({ statut: "refuse", cause: "client" });
    expect(f).not.toHaveBeenCalled();
  });
  it("carte sans nom, téléphone ou email du payeur : rien n'est inventé, aucun appel", async () => {
    for (const contact of [{ ...CARTE.contact, nom: null }, { ...CARTE.contact, telephone: null }, { ...CARTE.contact, email: null }]) {
      const f = faux();
      expect(await creerAdaptateurMaishaPay(() => CONFIG, f).initier({ ...CARTE, contact })).toEqual({ statut: "refuse", cause: "client" });
      expect(f).not.toHaveBeenCalled();
    }
  });
  it("carte : page de paiement absente ou non sécurisée refusée", async () => {
    await expect(creerAdaptateurMaishaPay(() => CONFIG, faux(reponse(ATTENTE, 202))).initier(CARTE)).rejects.toThrow();
    await expect(creerAdaptateurMaishaPay(() => CONFIG, faux(reponse({ ...ATTENTE, paymentPage: "http://exemple.invalid/x" }, 202))).initier(CARTE)).rejects.toThrow();
  });
});

describe("MaishaPay : consulterStatut (la consultation fait foi)", () => {
  const refs = { referenceInterne: REF, referenceTransaction: "12345" };
  it("interroge la recherche par référence marchand", async () => {
    const f = faux(reponse(verifie("SUCCESS")));
    await creerAdaptateurMaishaPay(() => CONFIG, f).consulterStatut(refs);
    expect(f.mock.calls[0][0]).toBe("https://marchand.maishapay.online/api/transaction/rest/v2/check?useRef=1");
    expect(corps(f)).toMatchObject({ transactionId: REF, gatewayMode: 0 });
  });
  it("SUCCESS : succès avec le montant et la devise tels que renvoyés", async () => {
    const r = await creerAdaptateurMaishaPay(() => CONFIG, faux(reponse(verifie("SUCCESS")))).consulterStatut(refs);
    expect(r).toEqual({ statut: "succes", referenceTransaction: "12345", montantRecu: "15", deviseRecue: "USD" });
  });
  it("PENDING, valeur inconnue ou casse différente : inconnu", async () => {
    for (const s of ["PENDING", "PENDING ", "Pending", "AUTRE"]) {
      expect((await creerAdaptateurMaishaPay(() => CONFIG, faux(reponse(verifie(s)))).consulterStatut(refs)).statut).toBe("inconnu");
    }
  });
  it("FAILED : échec traité comme un échec du client (cause non documentée)", async () => {
    expect((await creerAdaptateurMaishaPay(() => CONFIG, faux(reponse(verifie("FAILED")))).consulterStatut(refs)).statut).toBe("echec_client");
  });
  it("réponse d'une autre transaction ou d'un transfert B2C : jamais crue", async () => {
    expect((await creerAdaptateurMaishaPay(() => CONFIG, faux(reponse(verifie("SUCCESS", { originatingTransactionId: "AUTRE" })))).consulterStatut(refs)).statut).toBe("inconnu");
    expect((await creerAdaptateurMaishaPay(() => CONFIG, faux(reponse(verifie("SUCCESS", { transaction_type: "B2C | Transfert" })))).consulterStatut(refs)).statut).toBe("inconnu");
  });
  it("HTTP en erreur ou corps illisible : inconnu, jamais une validation", async () => {
    expect((await creerAdaptateurMaishaPay(() => CONFIG, faux(reponse(verifie("SUCCESS"), 500))).consulterStatut(refs)).statut).toBe("inconnu");
    expect((await creerAdaptateurMaishaPay(() => CONFIG, faux(reponse("<html>", 200))).consulterStatut(refs)).statut).toBe("inconnu");
  });
  it("succès sans devise lisible : la devise reste vide (le service ne validera pas)", async () => {
    const r = await creerAdaptateurMaishaPay(() => CONFIG, faux(reponse(verifie("SUCCESS", { order: { cost: { amount: 15 } } })))).consulterStatut(refs);
    expect(r).toMatchObject({ statut: "succes", montantRecu: "15", deviseRecue: null });
  });
});

describe("MaishaPay : verifierNotification (le rappel n'est qu'un signal)", () => {
  const post = (corps: unknown) => ({ methode: "POST" as const, en_tetes: {}, corps: JSON.stringify(corps), requete: "" });

  it("un rappel qui annonce SUCCESS n'est pas cru : le résultat vient de la consultation", async () => {
    const f = faux(reponse(verifie("PENDING")));
    const v = await creerAdaptateurMaishaPay(() => CONFIG, f).verifierNotification(post({ status_code: 200, transactionStatus: "SUCCESS", transactionId: 12345, originatingTransactionId: REF }));
    expect(v?.referenceInterne).toBe(REF);
    expect(v?.resultat.statut).toBe("inconnu");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("rappel POST vérifié par la consultation : succès", async () => {
    const v = await creerAdaptateurMaishaPay(() => CONFIG, faux(reponse(verifie("SUCCESS")))).verifierNotification(post({ transactionStatus: "SUCCESS", transactionId: 12345, originatingTransactionId: REF }));
    expect(v?.resultat).toMatchObject({ statut: "succes", montantRecu: "15", deviseRecue: "USD" });
    expect(v?.idNotification).toBe("12345:SUCCESS");
  });
  it("rappel GET de la carte : seule notre référence est retenue, puis consultation", async () => {
    const f = faux(reponse(verifie("SUCCESS")));
    const v = await creerAdaptateurMaishaPay(() => CONFIG, f).verifierNotification({ methode: "GET", en_tetes: {}, corps: "", requete: `status=200&description=APPROVED&transactionRefId=${REF}&operatorRefId=12345` });
    expect(v?.resultat.statut).toBe("succes");
    expect(corps(f)).toMatchObject({ transactionId: REF });
  });
  it("référence inconnue de MaishaPay (fausse notification) : rejetée", async () => {
    const f = faux(reponse({ message: "not found" }, 404));
    expect(await creerAdaptateurMaishaPay(() => CONFIG, f).verifierNotification(post({ transactionStatus: "SUCCESS", originatingTransactionId: "FAUX" }))).toBeNull();
  });
  it("corps illisible ou sans notre référence : rejeté sans aucun appel", async () => {
    const f = faux();
    const a = creerAdaptateurMaishaPay(() => CONFIG, f);
    expect(await a.verifierNotification({ methode: "POST", en_tetes: {}, corps: "pas du json", requete: "" })).toBeNull();
    expect(await a.verifierNotification(post({ transactionStatus: "SUCCESS" }))).toBeNull();
    expect(await a.verifierNotification({ methode: "GET", en_tetes: {}, corps: "", requete: "status=200" })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
