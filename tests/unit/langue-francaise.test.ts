import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Site en français uniquement (décision de Jonathan du 2026-11-22, spec « B ») : l'anglais est désactivé mais conservé.
// Faux client Supabase de test (règle 13 : tests uniquement) : visiteur non connecté.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: null, error: null }) } }),
}));
vi.mock("@/modules/catalogue/queries", () => ({ lireSlugsPublies: async () => [{ slug: "test-polo", famille: "vetement" }] }));
vi.mock("@/modules/blog/queries", () => ({ lireSlugsArticlesPublies: async () => [{ slug: "test-article", versionAnglaise: true }] }));

import sitemap from "@/app/sitemap";
import { redirectionsAdresses, reecrituresAdresses, versLangueActive } from "@/i18n/adresses";
import { choisirLangue } from "@/i18n/detection";
import { LANGUES_ACTIVES, PLUSIEURS_LANGUES, langueServie } from "@/i18n/routing";
import { construireMetadata } from "@/lib/seo/metadata";
import { alternatives } from "@/lib/seo/url";
import { lireTranches } from "@/modules/catalogue/tranches";
import { anglaisOuCopie, lireAlt, lireUnivers } from "@/modules/catalogue/schemas";
import { enregistrerReglage } from "@/modules/admin/service";
import { TEXTES } from "@/modules/envois/modeles/commun";
import { proxy } from "@/proxy";
import { creerTestDependancesAdmin } from "../doubles/TEST_dependances-admin";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
});
afterEach(() => vi.unstubAllEnvs());

describe("langues actives", () => {
  it("le français seul est actif ; toute langue demandée côté serveur devient le français", () => {
    expect(LANGUES_ACTIVES).toEqual(["fr"]);
    expect(PLUSIEURS_LANGUES).toBe(false);
    expect(langueServie("en")).toBe("fr");
    expect(langueServie("fr")).toBe("fr");
    expect(langueServie(null)).toBe("fr");
  });

  it("« / » : français même avec un navigateur anglais ou le cookie NEXT_LOCALE=en", () => {
    expect(choisirLangue("en", "en-US")).toBe("fr");
    expect(choisirLangue(undefined, "en-US,en;q=0.9")).toBe("fr");
    expect(choisirLangue(undefined, "de")).toBe("fr");
  });
});

describe("adresses /en : redirection vers la page française équivalente", () => {
  it.each([
    ["/en", "/fr"],
    ["/en/", "/fr"],
    ["/en/accessories/x", "/fr/accessoires/x"],
    ["/en/accessoires/x", "/fr/accessoires/x"],
    ["/en/clothing/polo", "/fr/vetements/polo"],
    ["/en/other-items", "/fr/autres-articles"],
    ["/en/cart", "/fr/panier"],
    ["/en/checkout/KS-2026-000001", "/fr/commande/KS-2026-000001"],
    ["/en/cosplays/y", "/fr/cosplays/y"],
    ["/en/blog/y", "/fr/blog/y"],
    ["/en/admin", "/fr/admin"],
    ["/en/admin/produits/abc", "/fr/admin/produits/abc"],
    ["/en/accueil-connecte", "/fr"],
    ["/en/introuvable", "/fr"],
    ["/EN/accessories/x", "/fr/accessoires/x"],
    ["/En", "/fr"],
  ])("%s → %s", (de, vers) => {
    expect(versLangueActive(de)).toBe(vers);
  });

  it("rien à rediriger hors d'une langue désactivée", () => {
    for (const chemin of ["/", "/fr", "/FR/accessoires", "/fr/accessoires", "/api/sante", "/english", "/enx/a", "/de/x"]) expect(versLangueActive(chemin)).toBeNull();
  });

  it("next.config.ts ne porte aucune règle /en (le proxy passe après les redirections de next.config)", () => {
    expect(redirectionsAdresses().every((r) => r.source.startsWith("/fr/") && r.destination.startsWith("/fr/"))).toBe(true);
    expect(reecrituresAdresses()).toEqual([]);
  });

  it.each([
    ["/en/accessories/x", "/fr/accessoires/x"],
    ["/en/blog/y", "/fr/blog/y"],
    ["/en/admin", "/fr/admin"],
    ["/en/accessories?tri=prix_asc", "/fr/accessoires?tri=prix_asc"],
  ])("proxy : %s répond 308 vers %s", async (de, vers) => {
    const r = await proxy(new NextRequest(`http://localhost:3000${de}`));
    expect(r.status).toBe(308);
    const cible = new URL(r.headers.get("location") ?? "");
    expect(`${cible.pathname}${cible.search}`).toBe(vers);
  });

  it("proxy : « / » mène à /fr avec un navigateur anglais et le cookie NEXT_LOCALE=en", async () => {
    const r = await proxy(new NextRequest("http://localhost:3000/", { headers: { "accept-language": "en-US", cookie: "NEXT_LOCALE=en" } }));
    expect(new URL(r.headers.get("location") ?? "").pathname).toBe("/fr");
  });
});

describe("SEO : français seulement", () => {
  it("aucun hreflang, aucune alternative anglaise", () => {
    expect(alternatives("/accessoires")).toEqual({});
    expect(alternatives("/blog/x", "", ["fr", "en"])).toEqual({});
  });

  it("metadata : canonique française, og:locale fr_FR sans alternateLocale, aucune langue alternative", () => {
    const m = construireMetadata({ locale: "fr", chemin: "/accessoires", titre: "T", description: "D", nomSite: "TEST_SITE", languesDisponibles: ["fr", "en"] });
    expect(m.alternates?.canonical).toBe("http://localhost:3000/fr/accessoires");
    expect(m.alternates).not.toHaveProperty("languages");
    expect(m.openGraph).toMatchObject({ locale: "fr_FR" });
    expect(m.openGraph).not.toHaveProperty("alternateLocale");
  });

  it("plan du site : aucune adresse /en, aucun hreflang, même pour un article qui a une version anglaise", async () => {
    const entrees = await sitemap();
    expect(entrees.length).toBeGreaterThan(0);
    expect(entrees.every((e) => e.url.startsWith("http://localhost:3000/fr"))).toBe(true);
    expect(entrees.some((e) => e.url === "http://localhost:3000/fr/vetements/test-polo")).toBe(true);
    expect(entrees.some((e) => e.url === "http://localhost:3000/fr/blog/test-article")).toBe(true);
    expect(entrees.every((e) => e.alternates === undefined)).toBe(true);
  });
});

describe("emails en français", () => {
  it("un Compte en anglais reçoit les textes français", () => {
    expect(TEXTES.en).toBe(TEXTES.fr);
  });
});

describe("colonnes anglaises obligatoires en base (Q5) : copie du français à la création, valeur existante gardée", () => {
  it("vide : copie du français ; saisie ou valeur renvoyée : gardée", () => {
    expect(anglaisOuCopie("", "Noir")).toBe("Noir");
    expect(anglaisOuCopie(null, "Noir")).toBe("Noir");
    expect(anglaisOuCopie("  Black ", "Noir")).toBe("Black");
  });

  it("univers, texte alternatif et tranche de prix", () => {
    expect(lireUnivers({ nomFr: " Univers ", nomEn: "" })).toEqual({ ok: true, nomFr: "Univers", nomEn: "Univers" });
    expect(lireUnivers({ nomFr: "Univers", nomEn: "Universe" })).toEqual({ ok: true, nomFr: "Univers", nomEn: "Universe" });
    expect(lireAlt("Face", "")).toEqual({ ok: true, altFr: "Face", altEn: "Face" });
    expect(lireAlt("Face", "Front")).toEqual({ ok: true, altFr: "Face", altEn: "Front" });
    const tranches = lireTranches([{ libelleFr: "Moins de 10 $", libelleEn: "", bas: "0", haut: "10" }]);
    expect(tranches.ok && tranches.tranches[0]).toMatchObject({ libelle_fr: "Moins de 10 $", libelle_en: "Moins de 10 $" });
  });

  it("lieu de retrait : le français est copié vers l'anglais absent, jamais par-dessus un anglais existant", async () => {
    const vide = creerTestDependancesAdmin({ retraitEn: null });
    expect(await enregistrerReglage(vide.deps, { cle: "retrait_goma_fr", valeur: "TEST_Lieu" })).toEqual({ ok: true, valeur: "TEST_Lieu" });
    expect(vide.appels.reglages).toEqual([
      expect.objectContaining({ cle: "retrait_goma_fr", valeur: "TEST_Lieu" }),
      expect.objectContaining({ cle: "retrait_goma_en", valeur: "TEST_Lieu" }),
    ]);

    const rempli = creerTestDependancesAdmin({ retraitEn: "TEST_Place" });
    expect(await enregistrerReglage(rempli.deps, { cle: "retrait_goma_fr", valeur: "TEST_Lieu" })).toEqual({ ok: true, valeur: "TEST_Lieu" });
    expect(rempli.appels.reglages).toEqual([expect.objectContaining({ cle: "retrait_goma_fr", valeur: "TEST_Lieu" })]);
  });

  it("lieu de retrait : lecture ou copie de l'anglais en échec, l'admin reçoit une erreur (jamais un faux succès)", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    const lecture = creerTestDependancesAdmin({ retraitEn: null, erreurLecture: "TEST_panne" });
    expect(await enregistrerReglage(lecture.deps, { cle: "retrait_goma_fr", valeur: "TEST_Lieu" })).toEqual({ ok: false, erreur: "generique" });
    const copie = creerTestDependancesAdmin({ retraitEn: null, erreurCopie: "TEST_refus" });
    expect(await enregistrerReglage(copie.deps, { cle: "retrait_goma_fr", valeur: "TEST_Lieu" })).toEqual({ ok: false, erreur: "generique" });
    expect(copie.appels.reglages).toHaveLength(2);
    journal.mockRestore();
  });
});
