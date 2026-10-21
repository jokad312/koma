import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Faux client Supabase de test (règle 13 : tests uniquement) : getClaims pose un cookie rafraîchi, comme le ferait
// @supabase/ssr quand le jeton d'accès a expiré.
const COOKIE_TEST = { nom: "sb-TEST-auth-token", valeur: "TEST_jeton-rafraichi" };

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _cle: string,
    options: { cookies: { setAll: (c: { name: string; value: string; options: object }[]) => void } },
  ) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll([{ name: COOKIE_TEST.nom, value: COOKIE_TEST.valeur, options: { path: "/", httpOnly: true } }]);
        return { data: null, error: null };
      },
    },
  }),
}));

import { proxy } from "@/proxy";

describe("proxy : cookies de session rafraîchis", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
  });
  afterEach(() => vi.unstubAllEnvs());

  const present = (reponse: Response) => reponse.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_TEST.nom}=${COOKIE_TEST.valeur}`));
  const transmis = (reponse: Response) => (reponse.headers.get("x-middleware-request-cookie") ?? "").includes(`${COOKIE_TEST.nom}=${COOKIE_TEST.valeur}`);

  it("sur la redirection de « / »", async () => {
    const reponse = await proxy(new NextRequest("http://localhost:3000/", { headers: { "accept-language": "fr" } }));
    expect(reponse.status).toBe(307);
    expect(present(reponse)).toBe(true);
  });

  it("sur la réponse next-intl, et dans les cookies de la requête transmise", async () => {
    const reponse = await proxy(new NextRequest("http://localhost:3000/fr/connexion", { headers: { cookie: "autre=1" } }));
    expect(present(reponse)).toBe(true);
    expect(transmis(reponse)).toBe(true);
    expect(reponse.headers.get("x-middleware-request-cookie")).toContain("autre=1");
  });

  it("sur une route hors langue (api)", async () => {
    const reponse = await proxy(new NextRequest("http://localhost:3000/api/sante"));
    expect(present(reponse)).toBe(true);
    expect(transmis(reponse)).toBe(true);
  });
});
