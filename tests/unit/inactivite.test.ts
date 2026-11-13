import { afterEach, describe, expect, it, vi } from "vitest";
import { estPageProtegee, evaluerActivite, heuresValides, lireDelaiInactiviteMs, viderCacheInactivite } from "@/lib/auth/inactivite";

const H = 3_600_000;
const MAINTENANT = 1_800_000_000_000;

describe("evaluerActivite", () => {
  const base = { maintenant: MAINTENANT, delaiMs: 4 * H };
  it("session récente : rien à faire", () => {
    expect(evaluerActivite({ ...base, aSession: true, valeur: String(MAINTENANT - 10_000) })).toBe("rien");
  });
  it("activité vieille de plus d'une minute : cookie réécrit", () => {
    expect(evaluerActivite({ ...base, aSession: true, valeur: String(MAINTENANT - 61_000) })).toBe("poser");
  });
  it("plus de 4 h et une minute (marge de réécriture du cookie) : expirée", () => {
    expect(evaluerActivite({ ...base, aSession: true, valeur: String(MAINTENANT - 4 * H - 60_000 - 1) })).toBe("expire");
  });
  it("entre 4 h et 4 h + 1 min : pas encore expirée (le cookie peut avoir jusqu'à une minute de retard)", () => {
    expect(evaluerActivite({ ...base, aSession: true, valeur: String(MAINTENANT - 4 * H) })).toBe("poser");
    expect(evaluerActivite({ ...base, aSession: true, valeur: String(MAINTENANT - 4 * H - 60_000) })).toBe("poser");
  });
  it("délai réglé à 1 h", () => {
    expect(evaluerActivite({ maintenant: MAINTENANT, delaiMs: H, aSession: true, valeur: String(MAINTENANT - 2 * H) })).toBe("expire");
  });
  it("session sans cookie (ancienne session) : cookie posé, pas de coupure", () => {
    expect(evaluerActivite({ ...base, aSession: true, valeur: undefined })).toBe("poser");
  });
  it("valeur illisible ou dans le futur : traitée comme absente", () => {
    expect(evaluerActivite({ ...base, aSession: true, valeur: "abc" })).toBe("poser");
    expect(evaluerActivite({ ...base, aSession: true, valeur: String(MAINTENANT + 5 * H) })).toBe("poser");
  });
  it("sans session : un vieux cookie est supprimé, sinon rien", () => {
    expect(evaluerActivite({ ...base, aSession: false, valeur: String(MAINTENANT - 9 * H) })).toBe("supprimer");
    expect(evaluerActivite({ ...base, aSession: false, valeur: undefined })).toBe("rien");
  });
});

describe("estPageProtegee", () => {
  it.each(["/compte", "/compte/commandes", "/commande", "/commande/KS-1", "/admin", "/admin/reglages", "/scan", "/checkout", "/checkout/KS-1"])(
    "%s exige un compte",
    (chemin) => expect(estPageProtegee(chemin)).toBe(true),
  );
  it.each(["/", "/cosplays", "/cosplays/x", "/blog", "/festival", "/festival/x", "/festival/x/acheter", "/festival/x/stand/abc", "/panier", "/connexion", "/comptex", "/administration", "/checkoutx"])("%s reste publique", (chemin) =>
    expect(estPageProtegee(chemin)).toBe(false),
  );
});

describe("heuresValides", () => {
  it("accepte 1 à 24, refuse le reste", () => {
    expect(heuresValides("1")).toBe(1);
    expect(heuresValides("24")).toBe(24);
    for (const v of ["0", "25", "abc", "", null, undefined, "4.5"]) expect(heuresValides(v)).toBeNull();
  });
});

describe("lireDelaiInactiviteMs", () => {
  afterEach(() => {
    viderCacheInactivite();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  function simuler(reponse: () => Promise<Response>) {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
    const faux = vi.fn(reponse);
    vi.stubGlobal("fetch", faux);
    return faux;
  }
  const json = (valeur: string | null) => async () =>
    new Response(JSON.stringify(valeur === null ? null : { valeur }), { status: 200, headers: { "content-type": "application/json", "content-profile": "public" } });

  it("lit le réglage puis le garde en cache une minute", async () => {
    const faux = simuler(json("2"));
    expect(await lireDelaiInactiviteMs(MAINTENANT)).toBe(2 * H);
    expect(await lireDelaiInactiviteMs(MAINTENANT + 30_000)).toBe(2 * H);
    expect(faux).toHaveBeenCalledTimes(1);
    await lireDelaiInactiviteMs(MAINTENANT + 61_000);
    expect(faux).toHaveBeenCalledTimes(2);
  });
  it("réglage absent ou hors bornes : 4 h", async () => {
    simuler(json(null));
    expect(await lireDelaiInactiviteMs(MAINTENANT)).toBe(4 * H);
    viderCacheInactivite();
    simuler(json("99"));
    expect(await lireDelaiInactiviteMs(MAINTENANT)).toBe(4 * H);
  });
  it("base muette : dernière valeur connue, sinon 4 h", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    simuler(async () => {
      throw new Error("TEST_reseau");
    });
    expect(await lireDelaiInactiviteMs(MAINTENANT)).toBe(4 * H);
  });
});
