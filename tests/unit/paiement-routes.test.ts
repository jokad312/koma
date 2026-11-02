import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", async () => {
  const reel = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...reel, connection: async () => {} };
});

const mocks = vi.hoisted(() => ({ session: vi.fn(), etat: vi.fn() }));
vi.mock("@/lib/auth/compte", () => ({ lireSessionVerifiee: mocks.session }));
vi.mock("@/lib/env", () => ({ lireEnvPublique: () => ({ NEXT_PUBLIC_SITE_URL: "https://test.invalid" }) }));
vi.mock("@/modules/paiement/etat-queries", () => ({ lireEtatPaiement: mocks.etat }));

import { GET as etatGet } from "@/app/api/commande/[numero]/etat/route";
import { GET as retourGet, POST as retourPost } from "@/app/api/paiement/retour/[prestataire]/route";
import { NextRequest } from "next/server";

const NUMERO = "KS-2026-000042";
const ETAT = { phase: "attente", statut: "en_attente", kit: false, attenteDepuisSecondes: 5, causeEchec: null, tropPercu: null };
const contexteEtat = (numero: string) => ({ params: Promise.resolve({ numero }) });
const contexteRetour = (prestataire: string) => ({ params: Promise.resolve({ prestataire }) });

describe("GET /api/commande/[numero]/etat", () => {
  beforeEach(() => {
    mocks.session.mockReset();
    mocks.etat.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  it("sans session : 401, la base n'est pas interrogée", async () => {
    mocks.session.mockResolvedValue(null);
    const r = await etatGet(new Request("http://localhost/x"), contexteEtat(NUMERO));
    expect(r.status).toBe(401);
    expect(mocks.etat).not.toHaveBeenCalled();
  });
  it("Commande d'un autre Compte ou inconnue : 404", async () => {
    mocks.session.mockResolvedValue({ compteId: "TEST_compte" });
    mocks.etat.mockResolvedValue(null);
    const r = await etatGet(new Request("http://localhost/x"), contexteEtat(NUMERO));
    expect(r.status).toBe(404);
    expect(mocks.etat).toHaveBeenCalledWith("TEST_compte", NUMERO);
  });
  it("état du Compte connecté : 200, l'état affichable seulement, jamais mis en cache", async () => {
    mocks.session.mockResolvedValue({ compteId: "TEST_compte" });
    mocks.etat.mockResolvedValue(ETAT);
    const r = await etatGet(new Request("http://localhost/x"), contexteEtat(NUMERO));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual(ETAT);
  });
  it("erreur de lecture : 500, sans détail", async () => {
    mocks.session.mockResolvedValue({ compteId: "TEST_compte" });
    mocks.etat.mockRejectedValue(new Error("TEST_secret"));
    const r = await etatGet(new Request("http://localhost/x"), contexteEtat(NUMERO));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("TEST_secret");
  });
});

const requete = (methode: string, url: string, corps?: BodyInit, cookie?: string) =>
  new NextRequest(url, { method: methode, body: corps, headers: cookie ? { cookie } : undefined });

describe("/api/paiement/retour/[prestataire]", () => {
  it("GET : redirige vers la page de la Commande, en ignorant tout paramètre de statut (FR-20)", async () => {
    const r = await retourGet(requete("GET", `http://localhost/api/paiement/retour/kpay?numero=${NUMERO}&status=success&paid=true`), contexteRetour("kpay"));
    expect(r.status).toBe(303);
    const cible = new URL(r.headers.get("location") ?? "");
    expect(cible.pathname).toBe(`/fr/commande/${NUMERO}`);
    expect(cible.search).toBe("");
  });
  it("POST : un retour en POST devient une lecture (303), le statut du corps est ignoré", async () => {
    const corps = new URLSearchParams({ numero: NUMERO, status: "success", amount: "1" });
    const r = await retourPost(requete("POST", "http://localhost/api/paiement/retour/polar", corps), contexteRetour("polar"));
    expect(r.status).toBe(303);
    expect(new URL(r.headers.get("location") ?? "").pathname).toBe(`/fr/commande/${NUMERO}`);
  });
  it("l'adresse de redirection vient de NEXT_PUBLIC_SITE_URL, jamais de l'hôte de la requête", async () => {
    const r = await retourGet(requete("GET", `http://interne.example/api/paiement/retour/kpay?numero=${NUMERO}`), contexteRetour("kpay"));
    expect(new URL(r.headers.get("location") ?? "").origin).toBe("https://test.invalid");
  });
  it("la langue vient du cookie : /en/checkout", async () => {
    const r = await retourGet(requete("GET", `http://localhost/api/paiement/retour/kpay?numero=${NUMERO}`, undefined, "NEXT_LOCALE=en"), contexteRetour("kpay"));
    expect(new URL(r.headers.get("location") ?? "").pathname).toBe(`/en/checkout/${NUMERO}`);
  });
  it("numéro absent ou mal formé : retour à l'étape de commande, jamais une adresse forgée", async () => {
    for (const numero of ["", "../../admin", "KS-2026-1", "https://autre.example"]) {
      const r = await retourGet(requete("GET", `http://localhost/api/paiement/retour/kpay?numero=${encodeURIComponent(numero)}`), contexteRetour("kpay"));
      expect(new URL(r.headers.get("location") ?? "").pathname).toBe("/fr/commande");
    }
  });
  it("Prestataire inconnu (dont GeniusPay, abandonné) : 404", async () => {
    for (const code of ["geniuspay", "x", "../kpay"]) {
      const r = await retourGet(requete("GET", `http://localhost/api/paiement/retour/${code}?numero=${NUMERO}`), contexteRetour(code));
      expect(r.status).toBe(404);
    }
  });
});
