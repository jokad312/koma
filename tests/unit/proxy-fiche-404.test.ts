import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Faux client Supabase et fausse existence de fiche (règle 13 : tests uniquement).
const COOKIE_TEST = { nom: "sb-TEST-auth-token", valeur: "TEST_jeton-rafraichi" };
const existence = vi.hoisted(() => ({ resultat: "non" as "oui" | "non" | "incertain" }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _cle: string,
    options: { cookies: { setAll: (c: { name: string; value: string; options: object }[]) => void } },
  ) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll([{ name: COOKIE_TEST.nom, value: COOKIE_TEST.valeur, options: { path: "/" } }]);
        return { data: null, error: null };
      },
    },
  }),
}));
vi.mock("@/modules/catalogue/existence", async (original) => ({
  ...(await original<typeof import("@/modules/catalogue/existence")>()),
  ficheExiste: vi.fn(async () => existence.resultat),
}));

import { proxy } from "@/proxy";
import { ficheExiste } from "@/modules/catalogue/existence";

const reecritVers = (r: Response) => r.headers.get("x-middleware-rewrite") ?? "";

describe("proxy : fiche introuvable", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
    vi.mocked(ficheExiste).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("« non » : statut 404, réécrit vers /<langue>/introuvable, cookies de session reportés", async () => {
    existence.resultat = "non";
    for (const [adresse, langue, famille] of [
      ["/fr/cosplays/abc", "fr", "cosplay"],
      ["/fr/accessoires/abc", "fr", "accessoire"],
      ["/en/accessories/abc", "en", "accessoire"],
    ] as const) {
      const r = await proxy(new NextRequest(`http://localhost:3000${adresse}`));
      expect(r.status).toBe(404);
      expect(new URL(reecritVers(r)).pathname).toBe(`/${langue}/introuvable`);
      expect(ficheExiste).toHaveBeenLastCalledWith(famille, "abc");
      expect(r.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_TEST.nom}=${COOKIE_TEST.valeur}`))).toBe(true);
    }
  });

  it("« oui » et « incertain » : réponse normale, jamais 404", async () => {
    for (const resultat of ["oui", "incertain"] as const) {
      existence.resultat = resultat;
      const r = await proxy(new NextRequest("http://localhost:3000/fr/cosplays/abc"));
      expect(r.status).not.toBe(404);
      expect(reecritVers(r)).not.toContain("introuvable");
    }
  });

  it("une adresse qui n'est pas une fiche n'appelle pas ficheExiste", async () => {
    existence.resultat = "non";
    for (const chemin of ["/fr/cosplays", "/fr/contact", "/fr/cosplays/a/b", "/en/accessoires/a", "/api/sante", "/"]) {
      await proxy(new NextRequest(`http://localhost:3000${chemin}`));
    }
    expect(ficheExiste).not.toHaveBeenCalled();
  });
});
