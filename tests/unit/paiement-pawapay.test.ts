import { describe, expect, it, vi } from "vitest";
import { creerAdaptateurPawaPay, identifiantDepot, providerPawaPay, QUESTIONS_OUVERTES, type ConfigPawaPay } from "@/modules/paiement/adaptateurs/pawapay";
import type { DonneesTentative } from "@/modules/paiement/types";

const CONFIG: ConfigPawaPay = { jeton: "TEST_JETON", production: false };
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
  contact: { telephone: "+243990000000", email: null, nom: null },
  reseauCarte: null,
  achat: { familles: ["cosplay"], estPass: false },
  adresseRetour: "https://TEST.invalid/retour",
  adresseNotification: "https://TEST.invalid/api/paiement/notification/pawapay",
};
const donnees = (id: string, extra: Record<string, unknown> = {}) => ({
  status: "FOUND",
  data: { depositId: id, status: "COMPLETED", amount: "15.00", currency: "USD", country: "COD", clientReferenceId: REF, providerTransactionId: "TEST-PTX-1", ...extra },
});

describe("PawaPay : questions ouvertes (règle 15)", () => {
  it("non activable : des questions restent ouvertes, même avec le jeton", () => {
    expect(creerAdaptateurPawaPay(() => CONFIG, faux()).questionsOuvertes).toEqual(QUESTIONS_OUVERTES);
    expect(QUESTIONS_OUVERTES.length).toBeGreaterThan(0);
  });
  it("sans jeton, la première raison l'indique", () => {
    expect(creerAdaptateurPawaPay(() => null, faux()).questionsOuvertes[0]).toMatch(/Jeton/);
  });
});

describe("PawaPay : identifiant de dépôt et opérateurs", () => {
  it("l'identifiant dérivé est un UUID stable, différent d'une référence à l'autre", async () => {
    const a = await identifiantDepot(REF);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await identifiantDepot(REF)).toBe(a);
    expect(await identifiantDepot(`${REF}x`)).not.toBe(a);
  });
  it("seuls les opérateurs documentés en dollar sont reconnus", () => {
    expect(providerPawaPay("CD", "Airtel Money")).toBe("AIRTEL_COD");
    expect(providerPawaPay("cd", "Orange Money")).toBe("ORANGE_COD");
    expect(providerPawaPay("CD", "M-Pesa")).toBe("VODACOM_MPESA_COD");
    expect(providerPawaPay("ZW", "EcoCash")).toBe("ECOCASH_ZWE");
    expect(providerPawaPay("TZ", "Airtel")).toBeNull();
    expect(providerPawaPay("CD", "Inconnu")).toBeNull();
  });
});

describe("PawaPay : initier", () => {
  it("dépôt en USD, identifiant dérivé, référence en clientReferenceId, jeton en Bearer, sans le « + » du numéro", async () => {
    const f = faux(reponse({ depositId: "x", status: "ACCEPTED", created: "2026-01-01T00:00:00Z" }));
    const r = await creerAdaptateurPawaPay(() => CONFIG, f).initier(MM);
    expect(r).toMatchObject({ statut: "initie", redirection: null });
    expect(f.mock.calls[0][0]).toBe("https://api.sandbox.pawapay.io/v2/deposits");
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer TEST_JETON" });
    expect(corps(f)).toMatchObject({ amount: "15", currency: "USD", clientReferenceId: REF, payer: { type: "MMO", accountDetails: { phoneNumber: "243990000000", provider: "AIRTEL_COD" } } });
    expect(corps(f).depositId).toBe(await identifiantDepot(REF));
  });
  it("production : adresse de production", async () => {
    const f = faux(reponse({ depositId: "x", status: "ACCEPTED" }));
    await creerAdaptateurPawaPay(() => ({ ...CONFIG, production: true }), f).initier(MM);
    expect(f.mock.calls[0][0]).toBe("https://api.pawapay.io/v2/deposits");
  });
  it("montants à décimales : 15,50 USD part en « 15.5 »", async () => {
    const f = faux(reponse({ depositId: "x", status: "ACCEPTED" }));
    await creerAdaptateurPawaPay(() => CONFIG, f).initier({ ...MM, montantAttenduCents: 1550 });
    expect(corps(f).amount).toBe("15.5");
  });
  it("pays ou opérateur non documentés, carte, ou sans numéro : aucun appel, refus côté prestataire (un autre agrégateur peut être proposé)", async () => {
    for (const t of [{ ...MM, pays: "TZ" }, { ...MM, moyen: "carte" as const }, { ...MM, contact: { ...MM.contact, telephone: null } }]) {
      const f = faux();
      expect(await creerAdaptateurPawaPay(() => CONFIG, f).initier(t)).toEqual({ statut: "refuse", cause: "prestataire" });
      expect(f).not.toHaveBeenCalled();
    }
  });
  it("REJECTED : refus ; doublon ignoré : la Tentative continue", async () => {
    expect(await creerAdaptateurPawaPay(() => CONFIG, faux(reponse({ depositId: "x", status: "REJECTED", failureReason: { failureCode: "INVALID_CURRENCY" } }))).initier(MM)).toEqual({ statut: "refuse", cause: "prestataire" });
    expect(await creerAdaptateurPawaPay(() => CONFIG, faux(reponse({ depositId: "x", status: "DUPLICATE_IGNORED" }))).initier(MM)).toMatchObject({ statut: "initie" });
  });
  it("réponse illisible, 500 ou coupure : exception, la Tentative reste en cours (jamais un échec inventé)", async () => {
    for (const f of [faux(reponse("pas du json", 502)), faux(reponse({}, 500)), faux(new Error("délai"))]) {
      await expect(creerAdaptateurPawaPay(() => CONFIG, f).initier(MM)).rejects.toThrow();
    }
  });
  it("sans jeton : exception, aucun appel", async () => {
    const f = faux();
    await expect(creerAdaptateurPawaPay(() => null, f).initier(MM)).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
});

describe("PawaPay : consulterStatut (fait foi)", () => {
  const lire = async (j: unknown, http = 200) => creerAdaptateurPawaPay(() => CONFIG, faux(reponse(j, http))).consulterStatut({ referenceInterne: REF, referenceTransaction: null });
  it("COMPLETED : succès avec le montant et la devise reçus ; la référence suivie est l'identifiant de dépôt", async () => {
    const id = await identifiantDepot(REF);
    expect(await lire(donnees(id))).toEqual({ statut: "succes", referenceTransaction: id, montantRecu: "15.00", deviseRecue: "USD" });
  });
  it("interroge le dépôt dérivé de NOTRE référence", async () => {
    const f = faux(reponse({ status: "NOT_FOUND" }));
    await creerAdaptateurPawaPay(() => CONFIG, f).consulterStatut({ referenceInterne: REF, referenceTransaction: null });
    expect(f.mock.calls[0][0]).toBe(`https://api.sandbox.pawapay.io/v2/deposits/${await identifiantDepot(REF)}`);
  });
  it("NOT_FOUND, erreur HTTP, corps illisible : inconnu", async () => {
    expect((await lire({ status: "NOT_FOUND" })).statut).toBe("inconnu");
    expect((await lire({}, 500)).statut).toBe("inconnu");
    expect((await lire("???")).statut).toBe("inconnu");
  });
  it("dépôt ou référence d'un autre paiement : inconnu, rien n'est validé", async () => {
    const id = await identifiantDepot(REF);
    expect((await lire(donnees("autre-id"))).statut).toBe("inconnu");
    expect((await lire(donnees(id, { clientReferenceId: "KS-AUTRE" }))).statut).toBe("inconnu");
  });
  it("ACCEPTED, PROCESSING, IN_RECONCILIATION : en cours", async () => {
    const id = await identifiantDepot(REF);
    for (const status of ["ACCEPTED", "PROCESSING", "IN_RECONCILIATION"]) expect((await lire(donnees(id, { status }))).statut).toBe("inconnu");
  });
  it("FAILED : codes du client = échec du client ; sans cause précise = échec du prestataire", async () => {
    const id = await identifiantDepot(REF);
    for (const failureCode of ["PAYMENT_NOT_APPROVED", "INSUFFICIENT_BALANCE", "PAYER_NOT_FOUND"]) {
      expect((await lire(donnees(id, { status: "FAILED", failureReason: { failureCode } }))).statut).toBe("echec_client");
    }
    for (const failureCode of ["UNSPECIFIED_FAILURE", "UNKNOWN_ERROR"]) {
      expect((await lire(donnees(id, { status: "FAILED", failureReason: { failureCode } }))).statut).toBe("echec_prestataire");
    }
  });
});

describe("PawaPay : notification (un signal, jamais une preuve)", () => {
  const requete = (c: unknown) => ({ methode: "POST" as const, en_tetes: {}, corps: typeof c === "string" ? c : JSON.stringify(c), requete: "" });
  it("le corps annoncé n'est pas cru : seul clientReferenceId est retenu, puis la consultation fait foi", async () => {
    const id = await identifiantDepot(REF);
    const f = faux(reponse(donnees(id)));
    const v = await creerAdaptateurPawaPay(() => CONFIG, f).verifierNotification(requete({ depositId: id, status: "COMPLETED", amount: "9999", currency: "USD", clientReferenceId: REF }));
    expect(v?.referenceInterne).toBe(REF);
    expect(v?.resultat).toMatchObject({ statut: "succes", montantRecu: "15.00" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("sans clientReferenceId, corps illisible ou paiement introuvable : null (401), rien n'est validé", async () => {
    const a = creerAdaptateurPawaPay(() => CONFIG, faux());
    expect(await a.verifierNotification(requete({ depositId: "x", status: "COMPLETED" }))).toBeNull();
    expect(await a.verifierNotification(requete("pas du json"))).toBeNull();
    expect(await creerAdaptateurPawaPay(() => CONFIG, faux(reponse({ status: "NOT_FOUND" }))).verifierNotification(requete({ clientReferenceId: REF }))).toBeNull();
  });
});

describe("PawaPay : comparerMontant", () => {
  const a = creerAdaptateurPawaPay(() => CONFIG, faux());
  it("compare le montant encaissé au montant attendu, en USD", () => {
    expect(a.comparerMontant(1500, "15.00", "USD")).toBe("egal");
    expect(a.comparerMontant(1500, "14.99", "USD")).toBe("inferieur");
    expect(a.comparerMontant(1500, "15.01", "usd")).toBe("superieur");
  });
  it("autre devise ou forme illisible : indéterminé", () => {
    expect(a.comparerMontant(1500, "15", "CDF")).toBe("indetermine");
    expect(a.comparerMontant(1500, "abc", "USD")).toBe("indetermine");
  });
});
