// Story 7.3 : route planifiée /api/cron/alertes-evenements (CRON_SECRET) et route d'export /api/admin/evenements/[id]/alertes-whatsapp.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", async () => {
  const reel = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...reel, connection: async () => {} };
});

const mocks = vi.hoisted(() => ({ planifierAlertes: vi.fn(), exporter: vi.fn() }));
vi.mock("@/modules/alertes/service", () => ({ planifierAlertes: mocks.planifierAlertes, exporterNumerosWhatsapp: mocks.exporter }));
vi.mock("@/modules/alertes/dependances", () => ({ dependancesAlertes: () => ({}), dependancesExportAlertes: () => ({}) }));

import { GET } from "@/app/api/admin/evenements/[id]/alertes-whatsapp/route";
import { POST } from "@/app/api/cron/alertes-evenements/route";

const requete = (autorisation?: string) =>
  new Request("http://localhost/api/cron/alertes-evenements", { method: "POST", headers: autorisation ? { authorization: autorisation } : {} });

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "TEST_secret");
  mocks.planifierAlertes.mockReset();
  mocks.exporter.mockReset();
  mocks.planifierAlertes.mockResolvedValue({ ok: true, nombre: 2 });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/cron/alertes-evenements", () => {
  it("refuse sans secret et avec un mauvais secret, sans rien planifier", async () => {
    expect((await POST(requete())).status).toBe(401);
    expect((await POST(requete("Bearer TEST_autre"))).status).toBe(401);
    expect(mocks.planifierAlertes).not.toHaveBeenCalled();
  });

  it("avec le bon secret : planifie et rend le nombre", async () => {
    const r = await POST(requete("Bearer TEST_secret"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, planifies: 2 });
  });

  it("échec de la base : 500, jamais un faux succès", async () => {
    mocks.planifierAlertes.mockResolvedValue({ ok: false });
    expect((await POST(requete("Bearer TEST_secret"))).status).toBe(500);
  });

  it("exception : 500 sans fuite de détail", async () => {
    mocks.planifierAlertes.mockRejectedValue(new Error("TEST_detail_interne"));
    const r = await POST(requete("Bearer TEST_secret"));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("TEST_detail_interne");
  });

  it("aucune méthode GET", async () => {
    const route = await import("@/app/api/cron/alertes-evenements/route");
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });
});

describe("GET /api/admin/evenements/[id]/alertes-whatsapp", () => {
  const appeler = (id = "00000000-0000-4000-8000-0000000000e1") =>
    GET(new Request(`http://localhost/api/admin/evenements/${id}/alertes-whatsapp`), { params: Promise.resolve({ id }) });

  it("export réussi : CSV en pièce jointe, jamais mis en cache", async () => {
    mocks.exporter.mockResolvedValue({ ok: true, csv: "numero_whatsapp\r\n+243810000000\r\n", nombre: 1 });
    const r = await appeler();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/csv");
    expect(r.headers.get("content-disposition")).toContain("attachment");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.text()).toBe("numero_whatsapp\r\n+243810000000\r\n");
  });

  it("statuts : non connecté 401, sans droit 403, inconnu 404, identifiant mal formé 400 ; aucun contenu", async () => {
    for (const [erreur, statut] of [["non_connecte", 401], ["non_autorise", 403], ["introuvable", 404], ["evenement_invalide", 400], ["generique", 500]] as const) {
      mocks.exporter.mockResolvedValue({ ok: false, erreur });
      const r = await appeler();
      expect(r.status).toBe(statut);
      expect(r.headers.get("content-type")).not.toContain("text/csv");
      expect(r.headers.get("cache-control")).toBe("no-store");
    }
  });
});
