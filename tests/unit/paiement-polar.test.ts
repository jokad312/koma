// Story 4.7 : adaptateur Polar (carte, paniers 100 % Kits). Faux accès réseau nommés TEST ; aucun vrai appel, aucune vraie clé.
// Règle 10 : aucun appel à Polar pour un Produit physique, un Pass ou un panier mixte. Règle 2 : le corps d'un webhook n'est jamais cru.
import { describe, expect, it, vi } from "vitest";
import { creerAdaptateurPolar, panierNumerique, QUESTIONS_OUVERTES, signatureWebhookValide, type ConfigPolar } from "@/modules/paiement/adaptateurs/polar";
import { ADAPTATEURS_BRANCHES, lireAdaptateur } from "@/modules/paiement/registre";
import type { DonneesTentative } from "@/modules/paiement/types";

const REF = "KS-2026-000123-1";
const PRODUIT = "00000000-0000-4000-8000-0000000000aa";
const CHECKOUT = "00000000-0000-4000-8000-0000000000bb";
// Secret de test (« whsec_ » + 24 octets en base64) : jamais un vrai secret.
const SECRET = `whsec_${btoa("TEST_secret_de_webhook_24b")}`;
const CONFIG: ConfigPolar = { jeton: "TEST_jeton", production: false, secretWebhook: SECRET, produitId: PRODUIT };

const KIT: DonneesTentative = {
  referenceInterne: REF,
  montantAttenduCents: 1500,
  moyen: "carte",
  pays: null,
  operateur: null,
  contact: { telephone: null, email: "TEST@example.invalid", nom: "Test Payeur" },
  reseauCarte: null,
  achat: { familles: ["kit"], estPass: false },
  adresseRetour: "https://TEST.invalid/retour",
  adresseNotification: "https://TEST.invalid/api/paiement/notification/polar",
};

const reponse = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });
const faux = (...reponses: Response[]) => {
  const f = vi.fn();
  for (const r of reponses) f.mockResolvedValueOnce(r);
  return f;
};
const adaptateur = (f: ReturnType<typeof vi.fn>, config: ConfigPolar | null = CONFIG) => creerAdaptateurPolar(() => config, f as unknown as typeof fetch);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- corps JSON de test, forme libre
const corps = (f: ReturnType<typeof vi.fn>, n = 0) => JSON.parse((f.mock.calls[n][1] as RequestInit).body as string) as Record<string, any>;

async function signer(id: string, horodatage: number, contenu: string, secret = SECRET): Promise<string> {
  const cle = Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0));
  const clef = await crypto.subtle.importKey("raw", cle as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", clef, new TextEncoder().encode(`${id}.${horodatage}.${contenu}`)));
  return `v1,${btoa(String.fromCharCode(...sig))}`;
}
async function webhook(enveloppe: unknown, options: { id?: string; horodatage?: number; secret?: string } = {}) {
  const contenu = JSON.stringify(enveloppe);
  const id = options.id ?? "msg_TEST_1";
  const horodatage = options.horodatage ?? Math.floor(Date.now() / 1000);
  return { methode: "POST" as const, corps: contenu, requete: "", en_tetes: { "webhook-id": id, "webhook-timestamp": String(horodatage), "webhook-signature": await signer(id, horodatage, contenu, options.secret) } };
}

describe("règle 10 : l'adaptateur refuse de lui-même tout ce qui n'est pas un panier de Kits", () => {
  it.each([
    ["cosplay", { familles: ["cosplay"], estPass: false }],
    ["accessoire", { familles: ["accessoire"], estPass: false }],
    ["panier mixte Kit + physique", { familles: ["kit", "accessoire"], estPass: false }],
    ["Pass", { familles: [], estPass: true }],
    ["Pass avec un Kit", { familles: ["kit"], estPass: true }],
    ["panier sans famille", { familles: [], estPass: false }],
  ] as const)("%s : refusé, aucun appel réseau", async (_nom, achat) => {
    const f = faux();
    expect(await adaptateur(f).initier({ ...KIT, achat })).toEqual({ statut: "refuse", cause: "prestataire" });
    expect(f).not.toHaveBeenCalled();
  });
  it("mobile money : refusé, aucun appel réseau", async () => {
    const f = faux();
    expect(await adaptateur(f).initier({ ...KIT, moyen: "mobile_money" })).toEqual({ statut: "refuse", cause: "prestataire" });
    expect(f).not.toHaveBeenCalled();
  });
  it("panierNumerique : seulement des Kits, jamais un Pass", () => {
    expect(panierNumerique({ achat: { familles: ["kit", "kit"], estPass: false } })).toBe(true);
    expect(panierNumerique({ achat: { familles: ["kit"], estPass: true } })).toBe(false);
  });
});

describe("initier", () => {
  it("crée la session avec le prix ad hoc en centimes USD, notre référence en metadata ; renvoie l'identifiant et l'adresse de Polar", async () => {
    const f = faux(reponse({ id: CHECKOUT, url: "https://sandbox.polar.sh/checkout/TEST_x", status: "open" }, 201));
    const r = await adaptateur(f).initier(KIT);
    expect(r).toEqual({ statut: "initie", referenceTransaction: CHECKOUT, redirection: "https://sandbox.polar.sh/checkout/TEST_x" });
    expect(f.mock.calls[0][0]).toBe("https://sandbox-api.polar.sh/v1/checkouts/");
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer TEST_jeton" });
    expect(corps(f)).toMatchObject({
      products: [PRODUIT],
      prices: { [PRODUIT]: [{ amount_type: "fixed", price_amount: 1500, price_currency: "usd" }] },
      success_url: "https://TEST.invalid/retour",
      metadata: { reference_interne: REF },
      customer_email: "TEST@example.invalid",
    });
  });
  it("chaque appel a un délai maximal et ne passe jamais par le cache", async () => {
    const f = faux(reponse({ id: CHECKOUT, url: "https://polar.sh/checkout/TEST_x" }, 201));
    await adaptateur(f).initier(KIT);
    expect(f.mock.calls[0][1]).toMatchObject({ cache: "no-store", signal: expect.any(AbortSignal) });
  });
  it("production : l'adresse de l'API de production", async () => {
    const f = faux(reponse({ id: CHECKOUT, url: "https://polar.sh/checkout/TEST_x" }, 201));
    await adaptateur(f, { ...CONFIG, production: true }).initier(KIT);
    expect(f.mock.calls[0][0]).toBe("https://api.polar.sh/v1/checkouts/");
  });
  it("adresse de paiement qui n'est pas Polar (ou pas https) : refusée, jamais suivie", async () => {
    for (const url of ["https://exemple.invalid/pirate", "http://polar.sh/checkout/x", "https://polar.sh.exemple.invalid/x"]) {
      expect(await adaptateur(faux(reponse({ id: CHECKOUT, url }, 201))).initier(KIT)).toEqual({ statut: "refuse", cause: "prestataire" });
    }
  });
  it("4xx (dont 422) : refus du Prestataire ; 429, 5xx et réponse illisible : la Tentative reste en cours (exception)", async () => {
    expect(await adaptateur(faux(reponse({ detail: "TEST" }, 422))).initier(KIT)).toEqual({ statut: "refuse", cause: "prestataire" });
    await expect(adaptateur(faux(reponse({}, 429))).initier(KIT)).rejects.toThrow();
    await expect(adaptateur(faux(reponse({}, 502))).initier(KIT)).rejects.toThrow();
    await expect(adaptateur(faux(new Response("pas du json", { status: 200 }))).initier(KIT)).rejects.toThrow();
  });
  it("sans clés : exception, aucun appel réseau", async () => {
    const f = faux();
    await expect(adaptateur(f, null).initier(KIT)).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
});

describe("consulterStatut", () => {
  const checkout = (statut: string, extra: Record<string, unknown> = {}) => ({ id: CHECKOUT, status: statut, metadata: { reference_interne: REF }, total_amount: 1500, currency: "usd", ...extra });
  const refs = { referenceInterne: REF, referenceTransaction: CHECKOUT };
  it("succeeded : succès avec le montant payé (dollars décimaux) et la devise", async () => {
    const f = faux(reponse(checkout("succeeded")));
    expect(await adaptateur(f).consulterStatut(refs)).toEqual({ statut: "succes", referenceTransaction: CHECKOUT, montantRecu: "15.00", deviseRecue: "USD" });
    expect(f.mock.calls[0][0]).toBe(`https://sandbox-api.polar.sh/v1/checkouts/${CHECKOUT}`);
  });
  it.each([
    ["open", "inconnu"],
    ["confirmed", "inconnu"],
    ["expired", "echec_client"],
    ["failed", "echec_prestataire"],
    ["autre", "inconnu"],
  ])("%s → %s", async (statut, attendu) => {
    expect((await adaptateur(faux(reponse(checkout(statut)))).consulterStatut(refs)).statut).toBe(attendu);
  });
  it("la réponse doit porter notre identifiant et notre référence : sinon inconnu", async () => {
    expect((await adaptateur(faux(reponse(checkout("succeeded", { metadata: { reference_interne: "KS-AUTRE" } })))).consulterStatut(refs)).statut).toBe("inconnu");
    expect((await adaptateur(faux(reponse(checkout("succeeded", { id: "autre" })))).consulterStatut(refs)).statut).toBe("inconnu");
    expect((await adaptateur(faux(reponse({}, 404))).consulterStatut(refs)).statut).toBe("inconnu");
  });
  it("sans identifiant de checkout : recherche des commandes par metadata, seule une commande payée à notre référence compte", async () => {
    const f = faux(reponse({ items: [{ status: "pending", metadata: { reference_interne: REF } }, { status: "paid", checkout_id: CHECKOUT, metadata: { reference_interne: REF }, total_amount: 1500, currency: "usd" }] }));
    expect(await adaptateur(f).consulterStatut({ referenceInterne: REF, referenceTransaction: null })).toEqual({ statut: "succes", referenceTransaction: CHECKOUT, montantRecu: "15.00", deviseRecue: "USD" });
    expect(String(f.mock.calls[0][0])).toContain(`/v1/orders/?metadata[reference_interne]=${REF}`);
    const autre = faux(reponse({ items: [{ status: "paid", metadata: { reference_interne: "KS-AUTRE" }, total_amount: 1500, currency: "usd" }] }));
    expect((await adaptateur(autre).consulterStatut({ referenceInterne: REF, referenceTransaction: null })).statut).toBe("inconnu");
  });
});

describe("signature des webhooks (Standard Webhooks)", () => {
  it("valide : signature correcte et horodatage récent", async () => {
    const r = await webhook({ type: "order.paid", data: {} });
    expect(await signatureWebhookValide(SECRET, r.en_tetes, r.corps)).toBe(true);
  });
  it("invalide : mauvais secret, corps modifié, horodatage trop ancien, en-tête manquant, secret sans préfixe", async () => {
    const r = await webhook({ type: "order.paid", data: {} });
    expect(await signatureWebhookValide(`whsec_${btoa("TEST_un_autre_secret_24by")}`, r.en_tetes, r.corps)).toBe(false);
    expect(await signatureWebhookValide(SECRET, r.en_tetes, r.corps + " ")).toBe(false);
    const vieux = await webhook({ type: "order.paid", data: {} }, { horodatage: Math.floor(Date.now() / 1000) - 3600 });
    expect(await signatureWebhookValide(SECRET, vieux.en_tetes, vieux.corps)).toBe(false);
    expect(await signatureWebhookValide(SECRET, { ...r.en_tetes, "webhook-signature": "" }, r.corps)).toBe(false);
    expect(await signatureWebhookValide("pas_un_secret", r.en_tetes, r.corps)).toBe(false);
  });
  it("plusieurs signatures séparées par une espace : une bonne suffit", async () => {
    const r = await webhook({ type: "order.paid", data: {} });
    expect(await signatureWebhookValide(SECRET, { ...r.en_tetes, "webhook-signature": `v1,AAAA ${r.en_tetes["webhook-signature"]}` }, r.corps)).toBe(true);
  });
});

describe("verifierNotification : jamais de confiance dans le corps (règle 2)", () => {
  const paye = { type: "order.paid", data: { checkout_id: CHECKOUT, metadata: { reference_interne: REF }, total_amount: 999999, currency: "usd" } };
  it("signature invalide : null (la route répond 401), aucun appel à Polar", async () => {
    const f = faux();
    const r = await webhook(paye, { secret: `whsec_${btoa("TEST_un_autre_secret_24by")}` });
    expect(await adaptateur(f).verifierNotification(r)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("GET ou sans clés : null", async () => {
    const r = await webhook(paye);
    expect(await adaptateur(faux()).verifierNotification({ ...r, methode: "GET" })).toBeNull();
    expect(await adaptateur(faux(), null).verifierNotification(r)).toBeNull();
  });
  it("order.paid signé : le résultat vient de la consultation de l'API, pas du montant du corps", async () => {
    const f = faux(reponse({ id: CHECKOUT, status: "succeeded", metadata: { reference_interne: REF }, total_amount: 1500, currency: "usd" }));
    const v = await adaptateur(f).verifierNotification(await webhook(paye));
    expect(v).toMatchObject({ idNotification: "msg_TEST_1", referenceInterne: REF, resultat: { statut: "succes", montantRecu: "15.00", deviseRecue: "USD" } });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("paiement pas confirmé par l'API malgré le webhook : inconnu (rien n'est validé)", async () => {
    const f = faux(reponse({ id: CHECKOUT, status: "open", metadata: { reference_interne: REF } }));
    const v = await adaptateur(f).verifierNotification(await webhook(paye));
    expect(v?.resultat.statut).toBe("inconnu");
  });
  it("événement signé sans rapport (remboursement, forme inconnue) : accepté sans référence, aucun appel à Polar (la route répond 200)", async () => {
    const f = faux();
    const v = await adaptateur(f).verifierNotification(await webhook({ type: "refund.created", data: {} }, { id: "msg_TEST_2" }));
    expect(v).toEqual({ idNotification: "msg_TEST_2", referenceInterne: null, resultat: { statut: "inconnu", referenceTransaction: null, montantRecu: null, deviseRecue: null } });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("comparerMontant : exact en USD, aucune tolérance", () => {
  const a = adaptateur(faux());
  it.each([
    ["15.00", "usd", "egal"],
    ["15", "USD", "egal"],
    ["14.99", "USD", "inferieur"],
    ["15.01", "USD", "superieur"],
    ["15.00", "EUR", "indetermine"],
    ["abc", "USD", "indetermine"],
    ["15.001", "USD", "indetermine"],
  ])("%s %s → %s", (montant, devise, attendu) => {
    expect(a.comparerMontant(1500, montant, devise)).toBe(attendu);
  });
});

describe("activation : jamais sur une hypothèse", () => {
  it("l'adaptateur est écrit mais non activable tant que des questions restent ouvertes", () => {
    expect(QUESTIONS_OUVERTES.length).toBeGreaterThan(0);
    expect(lireAdaptateur("polar")?.code).toBe("polar");
    expect(ADAPTATEURS_BRANCHES.has("polar")).toBe(false);
  });
  it("sans clés, la liste signale l'absence des clés en tête", () => {
    expect(adaptateur(faux(), null).questionsOuvertes[0]).toContain("Clés de Polar absentes");
    expect(adaptateur(faux()).questionsOuvertes).toEqual(QUESTIONS_OUVERTES);
  });
});
