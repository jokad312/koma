import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { RUBRIQUES } from "@/components/layout/rubriques";
import { versIsoBoutique } from "@/lib/dates";
import { evenementJsonLd } from "@/lib/seo/jsonld";
import { ESPACES_PUBLICS } from "@/lib/vitrine/marqueur";
import { adresseAvecAffiches, analyserRequeteEvenements, lireNombreAffiches } from "@/modules/evenements/adresse";

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

function cles(objet: unknown, prefixe = ""): string[] {
  if (objet === null || typeof objet !== "object") return [prefixe];
  return Object.entries(objet).flatMap(([k, v]) => cles(v, prefixe ? `${prefixe}.${k}` : k));
}

describe("navigation et messages", () => {
  it("la rubrique « Festival » est dans l'en-tête et le menu ☰ (mêmes liens), entre les Kits et le Blog", () => {
    expect(RUBRIQUES.map((r) => r.cle)).toEqual(["cosplays", "accessoires", "kits", "festival", "blog", "aPropos"]);
    expect(RUBRIQUES.find((r) => r.cle === "festival")?.href).toBe("/festival");
  });

  it("FR et EN ont exactement les mêmes clés, espace Festival compris, et Festival est un espace public contrôlé", () => {
    const fr = JSON.parse(readFileSync("messages/fr.json", "utf8"));
    const en = JSON.parse(readFileSync("messages/en.json", "utf8"));
    expect(cles(fr).sort()).toEqual(cles(en).sort());
    expect(Object.keys(fr.Festival)).toEqual(Object.keys(en.Festival));
    expect(ESPACES_PUBLICS).toContain("Festival");
    expect(fr.Festival.vide).toBe("Aucun événement à venir pour le moment.");
    expect(fr.Accueil.rendezVous.titre).toBe("Rendez-vous otaku");
  });
});

describe("adresse de la liste", () => {
  it("n'accepte qu'un multiple de 12 entre 12 et 1200 ; le reste ramène à la première page", () => {
    expect(lireNombreAffiches("12")).toBe(12);
    expect(lireNombreAffiches("1200")).toBe(1200);
    for (const mauvais of [null, "", "0", "11", "13", "1212", "-12", "12.5", "abc", "99999999"]) expect(lireNombreAffiches(mauvais)).toBeNull();
    expect(analyserRequeteEvenements({ affiches: ["24", "36"] })).toBe(24);
    expect(analyserRequeteEvenements(new URLSearchParams("affiches=12"))).toBe(12);
    expect(analyserRequeteEvenements({})).toBeNull();
  });

  it("construit l'adresse de la liste", () => {
    expect(adresseAvecAffiches("fr", 12)).toBe("/fr/festival?affiches=12");
    expect(adresseAvecAffiches("en", null)).toBe("/en/festival");
  });
});

describe("heure de Goma", () => {
  it("ISO avec le décalage +02:00, ou null", () => {
    expect(versIsoBoutique("2026-11-14T16:00:00+00:00")).toBe("2026-11-14T18:00:00+02:00");
    expect(versIsoBoutique("2026-12-31T23:30:00+00:00")).toBe("2027-01-01T01:30:00+02:00");
    expect(versIsoBoutique(null)).toBeNull();
    expect(versIsoBoutique("pas une date")).toBeNull();
  });
});

describe("evenementJsonLd", () => {
  it("ne contient que des données réelles : pas de lieu, d'offre ni d'image inventés", () => {
    const ld = evenementJsonLd({ nom: "TEST_Nom", description: null, lieu: null, debut: "2099-01-01T10:00:00+02:00", fin: null, images: [], url: "http://localhost:3000/fr/festival/x", langue: "fr", offres: [] });
    expect(ld).toEqual({ "@context": "https://schema.org", "@type": "Event", name: "TEST_Nom", startDate: "2099-01-01T10:00:00+02:00", url: "http://localhost:3000/fr/festival/x", inLanguage: "fr" });
  });

  it("prix en USD avec deux décimales, un prix de 0 reste 0.00", () => {
    const ld = evenementJsonLd({ nom: "TEST_Nom", description: "TEST_desc", lieu: "TEST_Lieu", debut: "d", fin: "f", images: ["u"], url: "http://localhost:3000/fr/festival/x", langue: "fr", offres: [{ nom: "TEST_gratuit", prixCents: 0 }, { nom: "TEST_vip", prixCents: 2550 }] });
    expect(ld.offers?.map((o) => [o.price, o.priceCurrency])).toEqual([["0.00", "USD"], ["25.50", "USD"]]);
    expect(ld.endDate).toBe("f");
  });
});
