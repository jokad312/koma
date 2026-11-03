import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", async () => {
  const reel = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...reel, connection: async () => {} };
});

const mocks = vi.hoisted(() => ({ deps: vi.fn(), secret: vi.fn() }));
vi.mock("@/modules/paiement/dependances-confirmation", () => ({ dependancesConfirmation: mocks.deps }));
vi.mock("@/lib/env", () => ({ lireEnvPublique: () => ({ NEXT_PUBLIC_SITE_URL: "https://test.invalid" }) }));
vi.mock("@/lib/auth/secret-cron", () => ({ secretCronValide: mocks.secret }));

import { GET, POST } from "@/app/api/paiement/notification/[prestataire]/route";
import { POST as cron } from "@/app/api/cron/reconcilier-tentatives/route";
import type { DependancesConfirmation } from "@/modules/paiement/confirmation";
import { NextRequest } from "next/server";
import { creerPrestataireTest } from "../doubles/TEST_prestataire";

const contexte = (prestataire: string) => ({ params: Promise.resolve({ prestataire }) });
const TENTATIVE = { id: "TEST_t", prestataire: "pawapay" as const, statut: "en_cours", referenceInterne: "TEST-REF-1", referenceTransaction: null, montantAttenduCents: 1500, commandeNumero: "KS-2026-000042" };

function deps(adaptateur: ReturnType<typeof creerPrestataireTest> | null): DependancesConfirmation {
  return {
    adaptateur: () => adaptateur,
    tentativeParReference: vi.fn(async () => TENTATIVE),
    enregistrerNotification: vi.fn(async () => true),
    confirmer: vi.fn(async () => ({ resultat: "payee" })),
    echouer: vi.fn(async () => undefined),
    toucher: vi.fn(async () => undefined),
    signalerIndetermine: vi.fn(async () => undefined),
    abandonnerPerimees: vi.fn(async () => 0),
    lot: vi.fn(async () => []),
  };
}
const succes = { idNotification: "TEST-N-1", referenceInterne: "TEST-REF-1", resultat: { statut: "succes" as const, referenceTransaction: "TX", montantRecu: "15", deviseRecue: "USD" } };

beforeEach(() => {
  mocks.deps.mockReset();
  mocks.secret.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("POST /api/paiement/notification/[prestataire]", () => {
  it("Prestataire inconnu : 404 sans toucher à la base", async () => {
    const r = await POST(new NextRequest("http://localhost/api/paiement/notification/geniuspay", { method: "POST", body: "{}" }), contexte("geniuspay"));
    expect(r.status).toBe(404);
    expect(mocks.deps).not.toHaveBeenCalled();
  });
  it("aucun adaptateur écrit : 404", async () => {
    mocks.deps.mockReturnValue(deps(null));
    const r = await POST(new NextRequest("http://localhost/x", { method: "POST", body: "{}" }), contexte("pawapay"));
    expect(r.status).toBe(404);
  });
  it("vérification échouée : 401, aucune validation", async () => {
    const d = deps(creerPrestataireTest({ code: "pawapay", notification: null, comparaison: "egal" }));
    mocks.deps.mockReturnValue(d);
    const r = await POST(new NextRequest("http://localhost/x", { method: "POST", body: "{}" }), contexte("pawapay"));
    expect(r.status).toBe(401);
    expect(d.confirmer).not.toHaveBeenCalled();
  });
  it("notification vérifiée : 200 et confirmer_paiement appelé une fois", async () => {
    const d = deps(creerPrestataireTest({ code: "pawapay", notification: succes, comparaison: "egal" }));
    mocks.deps.mockReturnValue(d);
    const r = await POST(new NextRequest("http://localhost/x", { method: "POST", body: "{}" }), contexte("pawapay"));
    expect(r.status).toBe(200);
    expect(d.confirmer).toHaveBeenCalledTimes(1);
  });
  it("panne de la base pendant la confirmation : 500, pour que le Prestataire rejoue", async () => {
    const d = deps(creerPrestataireTest({ code: "pawapay", notification: succes, comparaison: "egal" }));
    d.confirmer = vi.fn(async () => ({ erreur: "base" }));
    mocks.deps.mockReturnValue(d);
    const r = await POST(new NextRequest("http://localhost/x", { method: "POST", body: "{}" }), contexte("pawapay"));
    expect(r.status).toBe(500);
  });
  it("taille annoncée trop grande : 413 sans lire le corps", async () => {
    const r = await POST(new NextRequest("http://localhost/x", { method: "POST", body: "{}", headers: { "content-length": String(70 * 1024) } }), contexte("pawapay"));
    expect(r.status).toBe(413);
  });
  it("corps trop grand : 413, rien n'est traité", async () => {
    const r = await POST(new NextRequest("http://localhost/x", { method: "POST", body: "x".repeat(70 * 1024) }), contexte("pawapay"));
    expect(r.status).toBe(413);
    expect(mocks.deps).not.toHaveBeenCalled();
  });
});

describe("GET /api/paiement/notification/[prestataire] (retour du client avec résultat)", () => {
  it("traite le résultat vérifié puis renvoie le client vers la page de retour de sa Commande (303)", async () => {
    const d = deps(creerPrestataireTest({ code: "pawapay", notification: succes, comparaison: "egal" }));
    mocks.deps.mockReturnValue(d);
    const r = await GET(new NextRequest("http://localhost/api/paiement/notification/pawapay?status=200&transactionRefId=TEST-REF-1"), contexte("pawapay"));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("https://test.invalid/api/paiement/retour/pawapay?numero=KS-2026-000042");
    expect(d.confirmer).toHaveBeenCalledTimes(1);
  });
  it("paramètres falsifiés : l'adaptateur refuse, rien n'est validé, le client est quand même renvoyé vers la page de retour (sans numéro)", async () => {
    const d = deps(creerPrestataireTest({ code: "pawapay", notification: null, comparaison: "egal" }));
    mocks.deps.mockReturnValue(d);
    const r = await GET(new NextRequest("http://localhost/x?status=200&transactionRefId=FAUX"), contexte("pawapay"));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("https://test.invalid/api/paiement/retour/pawapay");
    expect(d.confirmer).not.toHaveBeenCalled();
  });
});

describe("POST /api/cron/reconcilier-tentatives", () => {
  it("sans le bon secret : 401, la base n'est pas interrogée", async () => {
    mocks.secret.mockReturnValue(false);
    const r = await cron(new Request("http://localhost/x", { method: "POST" }));
    expect(r.status).toBe(401);
    expect(mocks.deps).not.toHaveBeenCalled();
  });
  it("avec le bon secret : un bilan chiffré, sans référence ni montant", async () => {
    mocks.secret.mockReturnValue(true);
    mocks.deps.mockReturnValue(deps(null));
    const r = await cron(new Request("http://localhost/x", { method: "POST" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, interrogees: 0 });
  });
});
