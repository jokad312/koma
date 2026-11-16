import { expect, test, type Page } from "@playwright/test";
import { etatTypo, lireEnv, restesProduit, retirerProduit, semerProduit, violationsGraves, type ProduitTest } from "./police-outils";

// Story 9.16 a), ajout 1 de Jonathan : un caractère absent de KOMA Chikara (japonais d'un nom de produit, emoji) est dessiné par une
// police système, jamais par un carré vide. Produit TEST_ semé puis supprimé (comptage final à 0).
// Méthode : chaque caractère du titre est dessiné sur un canvas avec la police calculée de l'élément, puis comparé au dessin d'un point
// de code non attribué (U+0378) : une image identique signale un carré vide. Témoin : U+0379 doit donner le même carré. Là où la
// police de dernier recours dessine chaque point de code (GNU Unifont sur le runner Ubuntu de la CI : case avec le code hexadécimal),
// aucun carré vide ne peut apparaître et la comparaison ne prouve rien : elle est alors notée dans le rapport, pas exigée.

const env = lireEnv();
test.skip(!env, "variables Supabase absentes");

const PRODUIT: ProduitTest = {
  id: "00000000-0000-4000-8916-000000000002",
  slug: "test-e2e-916-secours",
  titre: "TEST_ 鬼滅の刃 cosplay 🔥",
  titreEn: "TEST_ 鬼滅の刃 cosplay 🔥 EN",
  fichier: "test-e2e-916/secours.jpg",
};

// Caractères de l'élément dessinés comme un carré vide (comparaison au rendu de U+0378 avec la même police).
async function carresVides(page: Page, selecteur: string): Promise<{ vides: string[]; temoin: boolean }> {
  return page.locator(selecteur).first().evaluate((el) => {
    const style = getComputedStyle(el);
    const police = `${style.fontSize} ${style.fontFamily}`;
    const dessiner = (texte: string) => {
      const c = document.createElement("canvas");
      c.width = 120;
      c.height = 80;
      const ctx = c.getContext("2d")!;
      ctx.font = police;
      ctx.textBaseline = "top";
      ctx.fillStyle = "#000";
      ctx.fillText(texte, 10, 10);
      return c.toDataURL();
    };
    const carre = dessiner("͸");
    const graphemes = [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(el.textContent ?? "")].map((s) => s.segment);
    // Témoin : un autre point de code non attribué donne bien le même carré (la méthode détecte un carré vide).
    const temoin = dessiner("͹") === carre;
    return { vides: graphemes.filter((g) => g.trim() !== "" && dessiner(g) === carre), temoin };
  });
}

// Exige « aucun carré vide » quand la méthode s'applique ; sinon, le note dans le rapport du test.
function exigerSansCarreVide(resultat: { vides: string[]; temoin: boolean }) {
  if (resultat.temoin) {
    expect(resultat.vides).toEqual([]);
    return;
  }
  test.info().annotations.push({
    type: "non vérifié ici",
    description: "la police de dernier recours dessine chaque point de code (cases hexadécimales) : aucun carré vide possible, comparaison sans objet",
  });
}

test.describe.configure({ mode: "serial" });

test.describe("police de secours : japonais et emoji dans un nom de produit", () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    await retirerProduit(env!, PRODUIT);
    await semerProduit(env!, PRODUIT);
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    try {
      await retirerProduit(env!, PRODUIT);
    } finally {
      expect(await restesProduit(env!, PRODUIT)).toEqual({ produits: 0, variantes: 0, photos: 0, fichiers: 0 });
    }
  });

  test("fiche : titre japonais + emoji dessiné sans carré vide, pile terminée par system-ui, sans-serif, 16 px minimum, axe", async ({ page }) => {
    await page.goto(`/fr/vetements/${PRODUIT.slug}`, { waitUntil: "load" });
    const titre = page.getByRole("heading", { level: 1, name: PRODUIT.titre });
    await expect(titre).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const famille = await titre.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(famille).toMatch(/komaChikara.*, system-ui, sans-serif$/);
    exigerSansCarreVide(await carresVides(page, "main h1"));
    expect((await etatTypo(page)).petits).toEqual([]);
    expect(await violationsGraves(page)).toEqual([]);
  });

  test("catalogue : le nom de la carte est dessiné sans carré vide", async ({ page }) => {
    await page.goto("/fr/vetements", { waitUntil: "load" });
    const carte = page.getByRole("heading", { level: 3, name: PRODUIT.titre });
    await expect(carte).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    exigerSansCarreVide(await carresVides(page, `h3:has-text("${PRODUIT.titre}")`));
  });
});
