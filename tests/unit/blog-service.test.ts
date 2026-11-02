import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { annulerEnvoiImage, changerPublication, demanderEnvoiImage, enregistrerArticle, finaliserImage } from "@/modules/blog/service";
import type { ArticleImage } from "@/modules/blog/types";
import { creerTestDependancesBlog } from "../doubles/TEST_dependances-blog";

const UUID = "11111111-1111-4111-8111-111111111111";
const OBJET = `articles/${UUID}.jpg`;
const ARTICLE = { titreFr: "Titre de test", texteFr: "Texte de test", titreEn: null, texteEn: null, slug: null, lienProduitId: null, images: [] as ArticleImage[] };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function jpeg(): Promise<Uint8Array> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer();
}

describe("enregistrerArticle", () => {
  it("création : droit, écriture puis invalidation du cache, succès avec cree vrai", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    expect(await enregistrerArticle(deps, { id: null, article: ARTICLE })).toEqual({ ok: true, id: "TEST_article-0001", cree: true });
    expect(appels.droits).toEqual(["blog.gerer"]);
    expect(appels.ordre).toEqual(["droit", "article", "invalidation"]);
    expect(appels.articles[0].article).toMatchObject({ titre_fr: "Titre de test", texte_fr: "Texte de test" });
    // Création : aucune lecture d'images existantes.
    expect(appels.ordre).not.toContain("lireImages");
  });

  it("adresse vide : déduite du titre français, sans accents", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    const article = { ...ARTICLE, titreFr: "Premier article : mon atelier", slug: null };
    expect(await enregistrerArticle(deps, { id: null, article })).toMatchObject({ ok: true });
    expect(appels.articles[0].article).toMatchObject({ slug: "premier-article-mon-atelier" });
  });

  it("adresse déjà prise : slug_pris, rien n'est invalidé", async () => {
    const { deps, appels } = creerTestDependancesBlog({ erreurArticle: "KS_SLUG_PRIS" });
    expect(await enregistrerArticle(deps, { id: null, article: ARTICLE })).toEqual({ ok: false, erreur: "slug_pris" });
    expect(appels.invalidations).toBe(0);
  });

  it("titre sans lettre latine et sans adresse : slug_invalide", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    const article = { ...ARTICLE, titreFr: "!!! ???", slug: null };
    expect(await enregistrerArticle(deps, { id: null, article })).toEqual({ ok: false, erreur: "slug_invalide" });
    expect(appels.articles).toEqual([]);
  });

  it("titre vide ou trop long : titre_invalide, rien n'est écrit", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    expect(await enregistrerArticle(deps, { id: null, article: { ...ARTICLE, titreFr: "   " } })).toEqual({ ok: false, erreur: "titre_invalide" });
    expect(await enregistrerArticle(deps, { id: null, article: { ...ARTICLE, titreFr: "a".repeat(121) } })).toEqual({ ok: false, erreur: "titre_invalide" });
    expect(appels.articles).toEqual([]);
  });

  it("adresse hors forme : slug_invalide ; identifiant mal formé : article_introuvable", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    expect(await enregistrerArticle(deps, { id: null, article: { ...ARTICLE, slug: "Pas Bon" } })).toEqual({ ok: false, erreur: "slug_invalide" });
    expect(await enregistrerArticle(deps, { id: "pas-un-uuid", article: ARTICLE })).toEqual({ ok: false, erreur: "article_introuvable" });
    expect(appels.articles).toEqual([]);
  });

  it("image hors du chemin articles/ : refusée avant l'écriture", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    const article = { ...ARTICLE, images: [{ fichier: "https://exemple.test/photo.jpg", altFr: "A", altEn: "B" }] };
    expect(await enregistrerArticle(deps, { id: null, article })).toEqual({ ok: false, erreur: "article_invalide" });
    expect(appels.articles).toEqual([]);
  });

  it("refus de la base : le code KS_ devient le code d'interface, pas de succès", async () => {
    const { deps, appels } = creerTestDependancesBlog({ erreurArticle: "KS_PUBLICATION_INCOMPLETE" });
    expect(await enregistrerArticle(deps, { id: null, article: ARTICLE })).toEqual({ ok: false, erreur: "publication_incomplete" });
    expect(appels.invalidations).toBe(0);
  });

  it("modification : les images retirées sont effacées du bucket public, les gardées restent", async () => {
    const gardee: ArticleImage = { fichier: `articles/22222222-2222-4222-8222-222222222222.jpg`, altFr: "A", altEn: "B" };
    const retiree: ArticleImage = { fichier: `articles/33333333-3333-4333-8333-333333333333.png`, altFr: "C", altEn: "D" };
    const { deps, appels } = creerTestDependancesBlog({ imagesExistantes: [gardee, retiree] });
    const article = { ...ARTICLE, images: [gardee] };
    expect(await enregistrerArticle(deps, { id: "00000000-0000-4000-8000-0000000000a2", article })).toMatchObject({ ok: true, cree: false });
    expect(appels.suppressions).toEqual([{ bucket: "produits-public", objet: retiree.fichier }]);
  });

  it("droit refusé : l'erreur remonte (jamais un succès)", async () => {
    const { deps, appels } = creerTestDependancesBlog({ droit: "KS_DROIT_REFUSE" });
    await expect(enregistrerArticle(deps, { id: null, article: ARTICLE })).rejects.toThrow("KS_DROIT_REFUSE");
    expect(appels.articles).toEqual([]);
  });
});

describe("changerPublication", () => {
  it("publication : écriture puis invalidation du cache", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    expect(await changerPublication(deps, { id: "00000000-0000-4000-8000-0000000000a2", publier: true })).toEqual({ ok: true, id: "00000000-0000-4000-8000-0000000000a2" });
    expect(appels.ordre).toEqual(["droit", "publication", "invalidation"]);
    expect(appels.publications[0].publier).toBe(true);
  });

  it("publication incomplète : refus explicite, cache non vidé", async () => {
    const { deps, appels } = creerTestDependancesBlog({ erreurPublication: "KS_PUBLICATION_INCOMPLETE" });
    expect(await changerPublication(deps, { id: "00000000-0000-4000-8000-0000000000a2", publier: true })).toEqual({ ok: false, erreur: "publication_incomplete" });
    expect(appels.invalidations).toBe(0);
  });

  it("identifiant mal formé : article_introuvable, aucun appel", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    expect(await changerPublication(deps, { id: "../article", publier: true })).toEqual({ ok: false, erreur: "article_introuvable" });
    expect(appels.publications).toEqual([]);
  });
});

describe("demanderEnvoiImage", () => {
  const envoi = (partiel = {}) => ({ type: "image/jpeg", taille: 2_000_000, ...partiel });

  it("signe un objet choisi par le serveur dans articles/", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    const r = await demanderEnvoiImage(deps, envoi());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.jeton).toBe("TEST_jeton-article");
    expect(r.objet).toMatch(/^articles\/[0-9a-f-]{36}\.jpg$/);
    expect(appels.signatures).toEqual([r.objet]);
    expect(appels.droits).toEqual(["blog.gerer"]);
  });

  it.each([
    ["image/png", "png"],
    ["image/webp", "webp"],
  ])("%s : extension %s", async (type, ext) => {
    const { deps } = creerTestDependancesBlog();
    const r = await demanderEnvoiImage(deps, envoi({ type }));
    expect(r.ok && r.objet.endsWith(`.${ext}`)).toBe(true);
  });

  it.each([["image/gif"], ["application/pdf"], [""], ["image/svg+xml"]])("type %j : format_invalide, rien n'est signé", async (type) => {
    const { deps, appels } = creerTestDependancesBlog();
    expect(await demanderEnvoiImage(deps, envoi({ type }))).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.signatures).toEqual([]);
  });

  it("15 Mo exactement accepté ; au-delà refusé", async () => {
    const { deps } = creerTestDependancesBlog();
    expect((await demanderEnvoiImage(deps, envoi({ taille: 15 * 1024 * 1024 }))).ok).toBe(true);
    expect(await demanderEnvoiImage(deps, envoi({ taille: 15 * 1024 * 1024 + 1 }))).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
  });

  it("signature impossible : générique, jamais un jeton inventé", async () => {
    const { deps } = creerTestDependancesBlog({ erreurSigner: "TEST_panne" });
    expect(await demanderEnvoiImage(deps, envoi())).toEqual({ ok: false, erreur: "generique" });
  });
});

describe("finaliserImage", () => {
  it("image réelle : nettoyée, copiée dans produits-public, original d'attente effacé", async () => {
    const { deps, appels } = creerTestDependancesBlog({ octetsAttente: await jpeg() });
    const r = await finaliserImage(deps, { objet: OBJET, altFr: "  Face  ", altEn: " Front " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fichier).toMatch(/^articles\/[0-9a-f-]{36}\.jpg$/);
    expect(r.altFr).toBe("Face");
    expect(r.altEn).toBe("Front");
    expect(appels.ecritsPublics[0].contentType).toBe("image/jpeg");
    expect(appels.suppressions).toEqual([{ bucket: "galerie-attente", objet: OBJET }]);
  });

  it.each([["articles/../secret.jpg"], ["https://exemple.test/x.jpg"], [`articles/${UUID}.gif`], ["produits/111.jpg"]])("objet %j : format_invalide, rien n'est lu", async (objet) => {
    const { deps, appels } = creerTestDependancesBlog();
    expect(await finaliserImage(deps, { objet, altFr: "A", altEn: "B" })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.ecritsPublics).toEqual([]);
  });

  it("texte alternatif vide : alt_invalide", async () => {
    const { deps } = creerTestDependancesBlog({ octetsAttente: await jpeg() });
    expect(await finaliserImage(deps, { objet: OBJET, altFr: "  ", altEn: "Front" })).toEqual({ ok: false, erreur: "alt_invalide" });
  });

  it("contenu qui n'est pas une image : format_invalide", async () => {
    const { deps } = creerTestDependancesBlog({ octetsAttente: new TextEncoder().encode("<script>alert(1)</script>") });
    expect(await finaliserImage(deps, { objet: OBJET, altFr: "A", altEn: "B" })).toEqual({ ok: false, erreur: "format_invalide" });
  });

  it("fichier absent du bucket d'attente : générique", async () => {
    const { deps } = creerTestDependancesBlog();
    expect(await finaliserImage(deps, { objet: OBJET, altFr: "A", altEn: "B" })).toEqual({ ok: false, erreur: "generique" });
  });

  it("échec de la copie publique : générique, original d'attente effacé", async () => {
    const { deps, appels } = creerTestDependancesBlog({ octetsAttente: await jpeg(), erreurEcriturePublique: "TEST_panne" });
    expect(await finaliserImage(deps, { objet: OBJET, altFr: "A", altEn: "B" })).toEqual({ ok: false, erreur: "generique" });
    expect(appels.suppressions).toContainEqual({ bucket: "galerie-attente", objet: OBJET });
  });
});

describe("annulerEnvoiImage", () => {
  it("efface seulement l'objet d'attente", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    expect(await annulerEnvoiImage(deps, { objet: OBJET })).toEqual({ ok: true });
    expect(appels.suppressions).toEqual([{ bucket: "galerie-attente", objet: OBJET }]);
  });

  it("chemin hors articles/ : refusé, rien n'est effacé", async () => {
    const { deps, appels } = creerTestDependancesBlog();
    expect(await annulerEnvoiImage(deps, { objet: "produits/x.jpg" })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.suppressions).toEqual([]);
  });
});
