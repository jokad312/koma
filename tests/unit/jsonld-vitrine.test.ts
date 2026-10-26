import { beforeEach, describe, expect, it } from "vitest";
import { faqJsonLd, filArianeJsonLd, pageContactJsonLd, pageWebJsonLd, serialiserJsonLd } from "@/lib/seo/jsonld";
import { MARQUEUR_TEXTE } from "@/lib/vitrine/marqueur";
import { lienWhatsapp } from "@/lib/vitrine/whatsapp";

const CONTEXTE = { url: "http://localhost:3000/fr/faq", langue: "fr" };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
});

describe("JSON-LD des pages vitrine", () => {
  it("FAQPage : seulement les paires dont ni la question ni la réponse ne contient le marqueur", () => {
    const json = faqJsonLd(
      [
        { question: "TEST_Q1", reponse: "TEST_R1" },
        { question: MARQUEUR_TEXTE, reponse: "TEST_R2" },
        { question: "TEST_Q3", reponse: `avant ${MARQUEUR_TEXTE}` },
      ],
      CONTEXTE,
    );
    expect(json?.["@type"]).toBe("FAQPage");
    expect(json?.mainEntity).toEqual([{ "@type": "Question", name: "TEST_Q1", acceptedAnswer: { "@type": "Answer", text: "TEST_R1" } }]);
    expect(serialiserJsonLd(json)).not.toContain(MARQUEUR_TEXTE);
  });

  it("aucune paire réelle : pas de FAQPage (null)", () => {
    expect(faqJsonLd([{ question: MARQUEUR_TEXTE, reponse: MARQUEUR_TEXTE }], CONTEXTE)).toBeNull();
    expect(faqJsonLd([], CONTEXTE)).toBeNull();
  });

  it("WebPage et ContactPage : type, nom, adresse et langue, sans note ni avis", () => {
    const entree = { nom: "TEST_nom", description: "TEST_desc", ...CONTEXTE };
    expect(pageWebJsonLd(entree)).toMatchObject({ "@type": "WebPage", name: "TEST_nom", url: CONTEXTE.url, inLanguage: "fr" });
    expect(pageContactJsonLd(entree)).toMatchObject({ "@type": "ContactPage", name: "TEST_nom" });
    expect(serialiserJsonLd(pageContactJsonLd(entree))).not.toMatch(/rating|review|aggregate/i);
  });
});

describe("lienWhatsapp", () => {
  it("chiffres seulement, sans message prérempli", () => {
    expect(lienWhatsapp("+243 970 000 000")).toBe("https://wa.me/243970000000");
  });
  it("numéro absent ou mal formé : null", () => {
    for (const v of [null, undefined, "", "  ", "abc", "243970000000", "+12", "+1234567890123456"]) expect(lienWhatsapp(v)).toBeNull();
  });
});

describe("filArianeJsonLd", () => {
  it("BreadcrumbList : positions 1 et 2, noms et adresses données, sans note ni avis", () => {
    const donnees = JSON.parse(
      serialiserJsonLd(
        filArianeJsonLd([
          { nom: "Home", url: "http://localhost:3000/en" },
          { nom: "Accessories", url: "http://localhost:3000/en/accessories" },
        ]),
      ),
    );
    expect(donnees["@type"]).toBe("BreadcrumbList");
    expect(donnees.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "http://localhost:3000/en" },
      { "@type": "ListItem", position: 2, name: "Accessories", item: "http://localhost:3000/en/accessories" },
    ]);
    expect(JSON.stringify(donnees)).not.toMatch(/rating|review|aggregate/i);
  });
});
