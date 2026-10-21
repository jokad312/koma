import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Faux client Supabase de test (règle 13 : tests uniquement). Le message contient un faux secret
// pour prouver qu'il n'est jamais journalisé.
const MESSAGE_TEST_SECRET = "TEST_jeton-secret-ne-pas-journaliser";
const comportement = vi.hoisted(() => ({ mode: "rejette" as "rejette" | "erreur" }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => {
        if (comportement.mode === "erreur") return { data: null, error: Object.assign(new Error(MESSAGE_TEST_SECRET), { name: "AuthRetryableFetchError" }) };
        throw new Error(MESSAGE_TEST_SECRET);
      },
    },
  }),
}));

import { proxy } from "@/proxy";

describe("proxy quand Supabase est indisponible", () => {
  let journal: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
    journal = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  for (const mode of ["rejette", "erreur"] as const) {
    it(`continue comme un visiteur non connecté (getClaims ${mode})`, async () => {
      comportement.mode = mode;

      const accueil = await proxy(new NextRequest("http://localhost:3000/", { headers: { "accept-language": "en-US" } }));
      expect(accueil.status).toBe(307);
      expect(accueil.headers.get("location")).toBe("http://localhost:3000/en");

      const page = await proxy(new NextRequest("http://localhost:3000/fr"));
      expect(page.status).toBeLessThan(400);

      const autre = await proxy(new NextRequest("http://localhost:3000/api/sante"));
      expect(autre.status).toBeLessThan(400);
    });
  }

  it("journalise sans donnée sensible", async () => {
    comportement.mode = "rejette";
    await proxy(new NextRequest("http://localhost:3000/fr"));
    comportement.mode = "erreur";
    await proxy(new NextRequest("http://localhost:3000/fr"));

    expect(journal).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(journal.mock.calls)).not.toContain(MESSAGE_TEST_SECRET);
  });
});
