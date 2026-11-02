import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", async () => {
  const reel = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...reel, connection: async () => {} };
});

const mocks = vi.hoisted(() => ({ traiterLot: vi.fn(), creerDependances: vi.fn() }));
vi.mock("@/modules/envois/service", () => ({ traiterLot: mocks.traiterLot }));
vi.mock("@/modules/envois/dependances", () => ({ creerDependancesEnvois: mocks.creerDependances }));

import { POST } from "@/app/api/cron/envois/route";

const requete = (autorisation?: string) =>
  new Request("http://localhost/api/cron/envois", { method: "POST", headers: autorisation ? { authorization: autorisation } : {} });

describe("POST /api/cron/envois", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "TEST_secret");
    vi.stubEnv("RESEND_API_KEY", "TEST_cle");
    vi.stubEnv("EMAIL_EXPEDITEUR", "TEST <test@example.invalid>");
    mocks.traiterLot.mockReset();
    mocks.creerDependances.mockReset();
    mocks.traiterLot.mockResolvedValue({ reserves: 1, envoyes: 1, ignores: 0, reessais: 0, erreurBase: false });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuse sans secret", async () => {
    expect((await POST(requete())).status).toBe(401);
    expect(mocks.traiterLot).not.toHaveBeenCalled();
  });

  it("refuse un mauvais secret", async () => {
    expect((await POST(requete("Bearer TEST_autre"))).status).toBe(401);
    expect(mocks.traiterLot).not.toHaveBeenCalled();
  });

  it("répond 503 sans clé Resend ou sans expéditeur, avant de réserver un envoi", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const r = await POST(requete("Bearer TEST_secret"));
    expect(r.status).toBe(503);
    expect(mocks.traiterLot).not.toHaveBeenCalled();
    vi.stubEnv("RESEND_API_KEY", "TEST_cle");
    vi.stubEnv("EMAIL_EXPEDITEUR", "");
    expect((await POST(requete("Bearer TEST_secret"))).status).toBe(503);
  });

  it("traite un lot avec le bon secret", async () => {
    const r = await POST(requete("Bearer TEST_secret"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, envoyes: 1 });
    expect(mocks.creerDependances).toHaveBeenCalledWith({ cleResend: "TEST_cle", expediteur: "TEST <test@example.invalid>" });
  });

  it("répond 500 sur une panne de base signalée par le lot", async () => {
    mocks.traiterLot.mockResolvedValue({ reserves: 0, envoyes: 0, ignores: 0, reessais: 0, erreurBase: true });
    expect((await POST(requete("Bearer TEST_secret"))).status).toBe(500);
  });

  it("répond 500 sur une exception, sans fuite de détail", async () => {
    mocks.traiterLot.mockRejectedValue(new Error("TEST_detail_interne"));
    const r = await POST(requete("Bearer TEST_secret"));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("TEST_detail_interne");
  });
});
