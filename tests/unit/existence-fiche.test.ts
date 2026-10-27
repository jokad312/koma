import { afterEach, describe, expect, it, vi } from "vitest";
import { analyserAdresseFiche, ficheExiste } from "@/modules/catalogue/existence";

describe("analyserAdresseFiche", () => {
  it("reconnaît les adresses propres de chaque langue", () => {
    expect(analyserAdresseFiche("/fr/cosplays/abc")).toEqual({ locale: "fr", famille: "cosplay", segment: "abc" });
    expect(analyserAdresseFiche("/fr/accessoires/abc")).toEqual({ locale: "fr", famille: "accessoire", segment: "abc" });
    expect(analyserAdresseFiche("/en/accessories/abc")).toEqual({ locale: "en", famille: "accessoire", segment: "abc" });
    expect(analyserAdresseFiche("/en/cosplays/abc")).toEqual({ locale: "en", famille: "cosplay", segment: "abc" });
  });

  // Comportement retenu : une barre finale est retirée par Next (308) avant le proxy ; si elle arrivait, le chemin a 5 morceaux et n'est pas
  // une fiche (chemin normal, aucune lecture). Majuscules et « / » encodés restent dans le segment : c'est ficheExiste qui les juge.
  it("barre finale : pas une fiche ; majuscules et %2F : segment conservé tel quel", () => {
    expect(analyserAdresseFiche("/fr/cosplays/abc/")).toBeNull();
    expect(analyserAdresseFiche("/fr/cosplays/Abc")?.segment).toBe("Abc");
    expect(analyserAdresseFiche("/fr/cosplays/a%2Fb")?.segment).toBe("a%2Fb");
    expect(analyserAdresseFiche("/fr/cosplays/a%252Fb")?.segment).toBe("a%252Fb");
  });

  it("ignore toute autre forme (catalogue, autre langue d'adresse, profondeur, autre page)", () => {
    for (const c of ["/fr/cosplays", "/fr/cosplays/a/b", "/en/accessoires/a", "/fr/accessories/a", "/fr/contact/a", "/de/cosplays/a", "/"]) {
      expect(analyserAdresseFiche(c)).toBeNull();
    }
  });
});

describe("ficheExiste", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const env = () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "cle-de-test");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  };

  // Comportement retenu : un slug de la base est toujours en minuscules, chiffres et tirets. Tout segment d'une autre forme (majuscules,
  // « / » encodé une ou deux fois, espace, encodage cassé) ne peut correspondre à aucune fiche : « non » certain, donc 404, sans lecture.
  it("répond « non » sans lire la base pour une adresse mal formée ou ambiguë", async () => {
    const fetchEspion = vi.fn();
    vi.stubGlobal("fetch", fetchEspion);
    for (const segment of ["Pas Valide!", "%E0%A4%A", "Test-Inexistant", "a%2Fb", "a%252Fb", "a/b", "-a", "a--b", "a".repeat(81)]) {
      expect(await ficheExiste("cosplay", segment)).toBe("non");
    }
    expect(fetchEspion).not.toHaveBeenCalled();
  });

  it("interroge produit avec slug, famille, prix fixé et photo obligatoire, pour chaque famille", async () => {
    env();
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (entree: RequestInfo | URL) => {
        urls.push(typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url);
        return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      }),
    );
    for (const famille of ["cosplay", "accessoire"] as const) {
      await ficheExiste(famille, "mon-produit");
      const u = new URL(urls[urls.length - 1]);
      expect(u.pathname).toBe("/rest/v1/produit");
      expect(u.searchParams.get("slug")).toBe("eq.mon-produit");
      expect(u.searchParams.get("famille")).toBe(`eq.${famille}`);
      expect(u.searchParams.get("prix_cents")).toBe("not.is.null");
      expect(u.searchParams.get("select")).toContain("produit_photo!inner");
    }
  });

  it("répond « incertain » (jamais une erreur) quand la base ne répond pas", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau coupé")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await ficheExiste("cosplay", "un-produit")).toBe("incertain");
  });

  it("répond « oui » ou « non » selon la ligne trouvée", async () => {
    env();
    const reponse = (corps: unknown) => new Response(JSON.stringify(corps), { status: 200, headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reponse([{ id: "x" }])).mockResolvedValueOnce(reponse([])));
    expect(await ficheExiste("cosplay", "un-produit")).toBe("oui");
    expect(await ficheExiste("cosplay", "un-produit")).toBe("non");
  });
});
