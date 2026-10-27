import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cheminPublic } from "@/i18n/adresses";
import { faqJsonLd } from "@/lib/seo/jsonld";
import { contientMarqueur, ESPACES_PUBLICS, MARQUEUR_TEXTE, trouverMarqueurs } from "@/lib/vitrine/marqueur";
import { BLOCS_ACCUEIL, blocsAffiches, NB_COSPLAYS_ACCUEIL, QUESTIONS_FAQ_COURTE } from "@/modules/accueil/blocs";

vi.mock("server-only", () => ({}));
const faux = vi.hoisted(() => ({ lister: vi.fn() }));
vi.mock("@/modules/catalogue/queries", () => ({ listerCatalogue: faux.lister }));
vi.mock("next/server", () => ({ connection: async () => undefined }));

import { lireCosplaysRecents } from "@/modules/accueil/cosplays-recents";

const messages = {
  fr: JSON.parse(readFileSync("messages/fr.json", "utf8")),
  en: JSON.parse(readFileSync("messages/en.json", "utf8")),
};

function carte(i: number) {
  return { id: `TEST_${i}`, slug: `test-${i}`, famille: "cosplay", titre: `Cosplay de test ${i}`, photoAlt: "Alt de test", photoUrl: "https://exemple.test/p.jpg", prixCents: 1000, disponibilite: "disponible" };
}

describe("liste ordonnée des blocs", () => {
  it("suit l'ordre de FR-2 et affiche héros, tuiles, bloc 2, bloc 6 et bloc 8 seulement", () => {
    expect(BLOCS_ACCUEIL.map((b) => b.id)).toEqual(["heros", "categories", "kits", "cosplaysRecents", "galerie", "rendezVousOtaku", "guides", "jonathan", "bloc7", "faqCourte"]);
    expect(blocsAffiches().map((b) => b.id)).toEqual(["heros", "categories", "cosplaysRecents", "jonathan", "faqCourte"]);
  });

  it("les emplacements des blocs 1, 3, 4, 5 et 7 sont réservés et documentés", () => {
    const reserves = BLOCS_ACCUEIL.filter((b) => b.etat === "reserve");
    expect(reserves.map((b) => b.numero)).toEqual([1, 3, 4, 5, 7]);
    for (const b of reserves) expect("arrivePar" in b && b.arrivePar.length > 0).toBe(true);
  });
});

describe("bloc 2 : derniers cosplays", () => {
  beforeEach(() => {
    faux.lister.mockReset();
  });

  it("aucun cosplay publié : liste vide (bloc masqué)", async () => {
    faux.lister.mockResolvedValue({ produits: [], suite: null });
    expect(await lireCosplaysRecents("fr")).toEqual([]);
  });

  it("6 cosplays publiés : les 4 premiers (tri nouveautés, famille cosplay)", async () => {
    faux.lister.mockResolvedValue({ produits: [1, 2, 3, 4, 5, 6].map(carte), suite: null });
    const produits = await lireCosplaysRecents("en");
    expect(produits.map((p) => p.id)).toEqual(["TEST_1", "TEST_2", "TEST_3", "TEST_4"]);
    expect(produits).toHaveLength(NB_COSPLAYS_ACCUEIL);
    expect(faux.lister).toHaveBeenCalledWith("cosplay", expect.objectContaining({ tri: "nouveautes", curseur: null }), "en");
  });

  it("lecture en erreur : liste vide et erreur journalisée", async () => {
    faux.lister.mockImplementation(() => {
      throw new Error("base indisponible");
    });
    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await lireCosplaysRecents("fr");
    expect(r).toEqual([]);
    expect(journal).toHaveBeenCalledTimes(1);
    expect(String(journal.mock.calls[0].join(" "))).toContain("base indisponible");
  });
});

describe("textes de l'accueil", () => {
  it("Accueil est un espace contrôlé par le build", () => {
    expect(ESPACES_PUBLICS).toContain("Accueil");
  });

  for (const langue of ["fr", "en"] as const) {
    const accueil = messages[langue].Accueil;

    it(`${langue} : seules les trois phrases de Jonathan portent le marqueur`, () => {
      expect(trouverMarqueurs(messages[langue], ["Accueil"])).toEqual(["Accueil.jonathan.phrase1", "Accueil.jonathan.phrase2", "Accueil.jonathan.phrase3"]);
      expect(contientMarqueur(accueil.heros.accroche)).toBe(false);
    });

    it(`${langue} : titres de blocs en majuscules sans accent`, () => {
      for (const titre of [accueil.categories.titre, accueil.cosplaysRecents.titre, accueil.jonathan.titre, accueil.faqCourte.titre]) {
        expect(titre).toBe(titre.toUpperCase());
        expect(titre.normalize("NFD")).not.toMatch(/[̀-ͯ]/);
      }
    });

    it(`${langue} : tuiles vers les catalogues de la langue`, () => {
      expect(cheminPublic(langue, "/cosplays")).toBe("/cosplays");
      expect(cheminPublic(langue, "/accessoires")).toBe(langue === "fr" ? "/accessoires" : "/accessories");
    });

    it(`${langue} : la FAQ courte lit les entrées de Faq et n'a aucun JSON-LD tant qu'elles portent le marqueur`, () => {
      const elements = QUESTIONS_FAQ_COURTE.map((cle) => ({
        question: messages[langue].Faq.questions[cle].question as string,
        reponse: messages[langue].Faq.questions[cle].reponse as string,
      }));
      expect(elements.every((e) => e.question === MARQUEUR_TEXTE)).toBe(true);
      expect(faqJsonLd(elements, { url: "https://exemple.test", langue })).toBeNull();
      const mixte = [...elements, { question: "Question de test ?", reponse: "Réponse de test." }];
      const json = faqJsonLd(mixte, { url: "https://exemple.test", langue });
      expect(json?.mainEntity).toHaveLength(1);
      expect(JSON.stringify(json)).not.toContain(MARQUEUR_TEXTE);
    });
  }
});
