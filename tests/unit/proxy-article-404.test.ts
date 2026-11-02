import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Faux client Supabase et fausse existence d'Article (règle 13 : tests uniquement).
const COOKIE_TEST = { nom: "sb-TEST-auth-token", valeur: "TEST_jeton-rafraichi" };
const article = vi.hoisted(() => ({ resultat: "non" as "oui" | "non" | "incertain" }));
const fiche = vi.hoisted(() => ({ resultat: "oui" as "oui" | "non" | "incertain" }));

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
vi.mock("@/modules/blog/existence", async (original) => ({
  ...(await original<typeof import("@/modules/blog/existence")>()),
  articleExiste: vi.fn(async () => article.resultat),
}));
vi.mock("@/modules/catalogue/existence", async (original) => ({
  ...(await original<typeof import("@/modules/catalogue/existence")>()),
  ficheExiste: vi.fn(async () => fiche.resultat),
}));

import { proxy } from "@/proxy";
import { articleExiste } from "@/modules/blog/existence";
import { ficheExiste } from "@/modules/catalogue/existence";

const reecritVers = (r: Response) => r.headers.get("x-middleware-rewrite") ?? "";

describe("proxy : Article introuvable", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
    article.resultat = "non";
    fiche.resultat = "oui";
    vi.mocked(articleExiste).mockClear();
    vi.mocked(ficheExiste).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("« non » : statut 404, réécrit vers /<langue>/introuvable, cookies de session reportés", async () => {
    for (const [adresse, langue] of [
      ["/fr/blog/article-test", "fr"],
      ["/en/blog/article-test", "en"],
    ] as const) {
      const r = await proxy(new NextRequest(`http://localhost:3000${adresse}`));
      expect(r.status).toBe(404);
      expect(new URL(reecritVers(r)).pathname).toBe(`/${langue}/introuvable`);
      expect(articleExiste).toHaveBeenLastCalledWith(langue, "article-test");
      expect(r.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_TEST.nom}=${COOKIE_TEST.valeur}`))).toBe(true);
    }
  });

  it("« oui » et « incertain » : réponse normale, jamais 404 (une base muette laisse le chemin normal décider)", async () => {
    for (const resultat of ["oui", "incertain"] as const) {
      article.resultat = resultat;
      const r = await proxy(new NextRequest("http://localhost:3000/fr/blog/article-test"));
      expect(r.status).not.toBe(404);
      expect(reecritVers(r)).not.toContain("introuvable");
    }
  });

  it("une adresse qui n'est pas un Article n'appelle pas articleExiste ; une fiche reste une fiche", async () => {
    for (const chemin of ["/fr/blog", "/fr/blog/a/b", "/fr/admin/blog/x", "/en/accessoires/a", "/api/sante", "/"]) {
      await proxy(new NextRequest(`http://localhost:3000${chemin}`));
    }
    expect(articleExiste).not.toHaveBeenCalled();

    fiche.resultat = "non";
    const r = await proxy(new NextRequest("http://localhost:3000/fr/cosplays/abc"));
    expect(r.status).toBe(404);
    expect(ficheExiste).toHaveBeenCalledWith("cosplay", "abc");
  });
});
