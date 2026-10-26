import { beforeEach, describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { ADRESSES, cheminAutreLangue, cheminPublic, redirectionsAdresses, reecrituresAdresses } from "@/i18n/adresses";
import { alternatives, cheminLocalise, urlLocalisee } from "@/lib/seo/url";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
});

describe("adresses propres à chaque langue", () => {
  it("la table donne l'adresse de chaque langue", () => {
    expect(cheminPublic("fr", "/accessoires")).toBe("/accessoires");
    expect(cheminPublic("en", "/accessoires")).toBe("/accessories");
    expect(cheminPublic("fr", "/cosplays")).toBe("/cosplays");
    expect(cheminPublic("en", "/cosplays")).toBe("/cosplays");
  });

  it("garde la suite du chemin (fiche produit de la 2.5) et ne touche qu'aux segments entiers", () => {
    expect(cheminPublic("en", "/accessoires/mon-produit")).toBe("/accessories/mon-produit");
    expect(cheminPublic("en", "/accessoiresx")).toBe("/accessoiresx");
    expect(cheminPublic("en", "/faq")).toBe("/faq");
    expect(cheminPublic("en", "/")).toBe("/");
  });

  it("le sélecteur de langue passe d'une adresse propre à l'autre", () => {
    expect(cheminAutreLangue("/accessoires", "fr", "en")).toBe("/accessories");
    expect(cheminAutreLangue("/accessories", "en", "fr")).toBe("/accessoires");
    expect(cheminAutreLangue("/accessories/x", "en", "fr")).toBe("/accessoires/x");
    expect(cheminAutreLangue("/cosplays", "fr", "en")).toBe("/cosplays");
    expect(cheminAutreLangue("/a-propos", "fr", "en")).toBe("/a-propos");
  });

  it("l'adresse de l'autre langue redirige en 308 vers la bonne, avec le reste du chemin", () => {
    expect(redirectionsAdresses()).toEqual(
      expect.arrayContaining([
        { source: "/en/accessoires/:chemin*", destination: "/en/accessories/:chemin*", permanent: true },
        { source: "/fr/accessories/:chemin*", destination: "/fr/accessoires/:chemin*", permanent: true },
      ]),
    );
    // Cosplays : même adresse dans les deux langues, aucune redirection.
    expect(redirectionsAdresses().some((r) => r.source.includes("cosplays"))).toBe(false);
    expect(redirectionsAdresses().every((r) => r.permanent)).toBe(true);
  });

  it("l'adresse anglaise est servie par le dossier interne, sans réécrire le français", () => {
    expect(reecrituresAdresses()).toEqual([{ source: "/en/accessories/:chemin*", destination: "/en/accessoires/:chemin*" }]);
  });

  it("aucune redirection ne boucle sur une adresse propre", () => {
    const propres = ADRESSES.flatMap((a) => (["fr", "en"] as const).map((l) => `/${l}${a[l]}`));
    for (const r of redirectionsAdresses()) {
      const base = r.source.replace("/:chemin*", "");
      expect(propres).not.toContain(base);
    }
  });
});

describe("canonique, hreflang et plan du site : toujours l'adresse propre de chaque langue", () => {
  it("chemin localisé et adresses alternatives", () => {
    expect(cheminLocalise("en", "/accessoires")).toBe("/en/accessories");
    expect(cheminLocalise("fr", "/accessoires")).toBe("/fr/accessoires");
    expect(urlLocalisee("en", "/accessoires", "curseur=ABC")).toBe("http://localhost:3000/en/accessories?curseur=ABC");
    expect(alternatives("/accessoires")).toEqual({
      fr: "http://localhost:3000/fr/accessoires",
      en: "http://localhost:3000/en/accessories",
      "x-default": "http://localhost:3000/fr/accessoires",
    });
  });

  it("le plan du site contient les deux catalogues dans les deux langues, avec leur adresse propre", () => {
    const entrees = sitemap();
    const urls = entrees.map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "http://localhost:3000/fr/cosplays",
        "http://localhost:3000/en/cosplays",
        "http://localhost:3000/fr/accessoires",
        "http://localhost:3000/en/accessories",
      ]),
    );
    expect(urls).not.toContain("http://localhost:3000/en/accessoires");
    expect(urls).not.toContain("http://localhost:3000/fr/accessories");
    expect(entrees.find((e) => e.url === "http://localhost:3000/fr/accessoires")?.alternates?.languages).toEqual({
      fr: "http://localhost:3000/fr/accessoires",
      en: "http://localhost:3000/en/accessories",
      "x-default": "http://localhost:3000/fr/accessoires",
    });
  });
});
