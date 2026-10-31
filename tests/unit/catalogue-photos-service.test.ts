import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { annulerEnvoiPhoto, demanderEnvoiPhoto, depublierProduit, deplacerPhoto, finaliserPhoto, publierProduit } from "@/modules/catalogue/service";
import { creerTestDependancesCatalogue, TEST_ADMIN_ID, TEST_PRODUIT_COMPLET } from "../doubles/TEST_dependances-catalogue";

const PRODUIT = "00000000-0000-4000-8000-0000000000bb";
const AUTRE = "00000000-0000-4000-8000-0000000000cc";
const PHOTO = "00000000-0000-4000-8000-0000000000dd";
const OBJET = `${PRODUIT}/11111111-1111-4111-8111-111111111111.jpg`;
const AUTEUR = { type: "compte", id: TEST_ADMIN_ID, role: "admin" };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const envoi = (partiel = {}) => ({ produitId: PRODUIT, type: "image/jpeg", taille: 2_000_000, altFr: "Face", altEn: "Front", ...partiel });

async function jpeg(): Promise<Uint8Array> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer();
}

describe("demanderEnvoiPhoto", () => {
  it("droit, produit puis signature d'un objet choisi par le serveur dans le dossier du produit", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    const r = await demanderEnvoiPhoto(deps, envoi());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.jeton).toBe("TEST_jeton");
    expect(r.objet).toMatch(new RegExp(`^${PRODUIT}/[0-9a-f-]{36}\\.jpg$`));
    expect(appels.signatures).toEqual([r.objet]);
    expect(appels.droits).toEqual(["produits.modifier"]);
    expect(appels.ordre[0]).toBe("droit");
  });

  it.each([
    ["image/png", "png"],
    ["image/webp", "webp"],
  ])("%s : extension %s", async (type, ext) => {
    const { deps } = creerTestDependancesCatalogue();
    const r = await demanderEnvoiPhoto(deps, envoi({ type }));
    expect(r.ok && r.objet.endsWith(`.${ext}`)).toBe(true);
  });

  it.each([["image/gif"], ["application/pdf"], [""], ["image/svg+xml"]])("type %j : format_invalide, rien n'est signé", async (type) => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await demanderEnvoiPhoto(deps, envoi({ type }))).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.signatures).toEqual([]);
  });

  it("15 Mo exactement : accepté ; 15 Mo + 1 octet : fichier_trop_lourd", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect((await demanderEnvoiPhoto(deps, envoi({ taille: 15 * 1024 * 1024 }))).ok).toBe(true);
    expect(await demanderEnvoiPhoto(deps, envoi({ taille: 15 * 1024 * 1024 + 1 }))).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(appels.signatures).toHaveLength(1);
  });

  it("taille nulle ou négative : refusée", async () => {
    const { deps } = creerTestDependancesCatalogue();
    expect((await demanderEnvoiPhoto(deps, envoi({ taille: 0 }))).ok).toBe(false);
    expect((await demanderEnvoiPhoto(deps, envoi({ taille: -5 }))).ok).toBe(false);
  });

  it("texte alternatif vide ou trop long : alt_invalide", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await demanderEnvoiPhoto(deps, envoi({ altFr: "   " }))).toEqual({ ok: false, erreur: "alt_invalide" });
    expect(await demanderEnvoiPhoto(deps, envoi({ altEn: "x".repeat(201) }))).toEqual({ ok: false, erreur: "alt_invalide" });
    expect(appels.signatures).toEqual([]);
  });

  it("11e photo : photos_limite", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ produitComplet: { ...TEST_PRODUIT_COMPLET, nbPhotos: 10 } });
    expect(await demanderEnvoiPhoto(deps, envoi())).toEqual({ ok: false, erreur: "photos_limite" });
    expect(appels.signatures).toEqual([]);
  });

  it("produit inconnu ou identifiant mal formé : produit_introuvable", async () => {
    expect(await demanderEnvoiPhoto(creerTestDependancesCatalogue({ produitComplet: null }).deps, envoi())).toEqual({ ok: false, erreur: "produit_introuvable" });
    expect(await demanderEnvoiPhoto(creerTestDependancesCatalogue().deps, envoi({ produitId: "pas-un-uuid" }))).toEqual({ ok: false, erreur: "produit_introuvable" });
  });

  it.each([
    ["KS_NON_CONNECTE", "non_autorise"],
    ["KS_DROIT_REFUSE", "non_autorise"],
    ["KS_VERIFICATION_IMPOSSIBLE", "generique"],
  ] as const)("droit %s : %s, rien n'est lu ni signé", async (droit, erreur) => {
    const { deps, appels } = creerTestDependancesCatalogue({ droit });
    expect(await demanderEnvoiPhoto(deps, envoi())).toEqual({ ok: false, erreur });
    expect(appels.ordre).toEqual(["droit"]);
  });

  it("échec de signature ou de lecture : generique", async () => {
    expect(await demanderEnvoiPhoto(creerTestDependancesCatalogue({ erreurSigner: "TEST_storage" }).deps, envoi())).toEqual({ ok: false, erreur: "generique" });
    expect(await demanderEnvoiPhoto(creerTestDependancesCatalogue({ lectureProduitEnEchec: true }).deps, envoi())).toEqual({ ok: false, erreur: "generique" });
  });
});

describe("finaliserPhoto", () => {
  const entree = (partiel = {}) => ({ produitId: PRODUIT, objet: OBJET, altFr: " Face ", altEn: "Front", ...partiel });

  it("nettoie, écrit dans le bucket public, enregistre, puis efface l'original d'attente", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: await jpeg() });
    const r = await finaliserPhoto(deps, entree());
    expect(r).toEqual({ ok: true, id: "TEST_photo-0001" });
    expect(appels.ordre).toEqual(["droit", "lireAttente", "ecrirePublic", "photo", "invalidation", "supprimer:galerie-attente"]);
    expect(appels.ecritsPublics).toHaveLength(1);
    const publie = appels.ecritsPublics[0];
    expect(publie.objet).toMatch(new RegExp(`^${PRODUIT}/[0-9a-f-]{36}\\.jpg$`));
    expect(publie.contentType).toBe("image/jpeg");
    expect(appels.photos).toEqual([{ auteur: AUTEUR, produitId: PRODUIT, fichier: publie.objet, altFr: "Face", altEn: "Front" }]);
    expect(appels.suppressions).toEqual([{ bucket: "galerie-attente", objets: [OBJET] }]);
  });

  it("l'extension suit le format réel détecté, pas le nom envoyé", async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: png });
    expect((await finaliserPhoto(deps, entree())).ok).toBe(true);
    expect(appels.ecritsPublics[0].objet.endsWith(".png")).toBe(true);
    expect(appels.ecritsPublics[0].contentType).toBe("image/png");
  });

  it.each([
    ["texte déguisé en .jpg", async () => new TextEncoder().encode("pas une image")],
    ["gif", async () => sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } } }).gif().toBuffer()],
  ])("%s : format_invalide, rien d'écrit en public, original d'attente effacé", async (_nom, fabriquer) => {
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: await fabriquer() });
    expect(await finaliserPhoto(deps, entree())).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.ecritsPublics).toEqual([]);
    expect(appels.photos).toEqual([]);
    expect(appels.suppressions).toEqual([{ bucket: "galerie-attente", objets: [OBJET] }]);
  });

  it("texte alternatif vide : alt_invalide, original d'attente effacé", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: await jpeg() });
    expect(await finaliserPhoto(deps, entree({ altEn: "" }))).toEqual({ ok: false, erreur: "alt_invalide" });
    expect(appels.ordre).toEqual(["droit", "supprimer:galerie-attente"]);
  });

  it("l'enregistrement échoue : l'objet public est effacé (aucun orphelin) et l'original aussi", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: await jpeg(), erreurPhoto: "KS_PHOTOS_LIMITE" });
    expect(await finaliserPhoto(deps, entree())).toEqual({ ok: false, erreur: "photos_limite" });
    expect(appels.suppressions.map((s) => s.bucket)).toEqual(["produits-public", "galerie-attente"]);
    expect(appels.suppressions[0].objets).toEqual([appels.ecritsPublics[0].objet]);
  });

  it("erreur inconnue de la base : generique, rien d'orphelin", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: await jpeg(), erreurPhoto: "TEST_panne" });
    expect(await finaliserPhoto(deps, entree())).toEqual({ ok: false, erreur: "generique" });
    expect(appels.suppressions.map((s) => s.bucket)).toEqual(["produits-public", "galerie-attente"]);
  });

  it("écriture publique en échec : generique, aucune photo enregistrée, original effacé", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: await jpeg(), erreurEcriturePublique: "TEST_storage" });
    expect(await finaliserPhoto(deps, entree())).toEqual({ ok: false, erreur: "generique" });
    expect(appels.photos).toEqual([]);
    // L'écriture a échoué sans certitude : l'objet public éventuel est effacé, puis l'original.
    expect(appels.suppressions.map((s) => s.bucket)).toEqual(["produits-public", "galerie-attente"]);
    expect(appels.invalidations).toBe(0);
  });

  it("l'écriture publique LÈVE : l'objet public (posé avant l'appel) est quand même effacé", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: await jpeg(), leveEcriturePublique: true });
    expect(await finaliserPhoto(deps, entree())).toEqual({ ok: false, erreur: "generique" });
    expect(appels.photos).toEqual([]);
    expect(appels.suppressions).toEqual([
      { bucket: "produits-public", objets: [appels.ecritsPublics[0].objet] },
      { bucket: "galerie-attente", objets: [OBJET] },
    ]);
  });

  it("ecrirePhoto LÈVE (résultat inconnu) : l'objet public n'est PAS effacé, l'original l'est", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: await jpeg(), levePhoto: true });
    expect(await finaliserPhoto(deps, entree())).toEqual({ ok: false, erreur: "generique" });
    expect(appels.suppressions).toEqual([{ bucket: "galerie-attente", objets: [OBJET] }]);
    expect(appels.invalidations).toBe(0);
  });

  it("identifiant de produit en majuscules : passé en minuscules avant tout traitement", async () => {
    const MAJ = PRODUIT.toUpperCase();
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: await jpeg() });
    expect((await finaliserPhoto(deps, entree({ produitId: MAJ }))).ok).toBe(true);
    expect(appels.photos[0].produitId).toBe(PRODUIT);
    expect(appels.ecritsPublics[0].objet.startsWith(`${PRODUIT}/`)).toBe(true);
    const e = creerTestDependancesCatalogue();
    const r = await demanderEnvoiPhoto(e.deps, envoi({ produitId: MAJ }));
    expect(r.ok && r.objet.startsWith(`${PRODUIT}/`)).toBe(true);
  });

  it("type MIME hérité de Object (constructor, toString) : format_invalide", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    for (const type of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(await demanderEnvoiPhoto(deps, envoi({ type }))).toEqual({ ok: false, erreur: "format_invalide" });
    }
    expect(appels.signatures).toEqual([]);
  });

  it("original illisible : generique", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ erreurLectureAttente: "TEST_absent" });
    expect(await finaliserPhoto(deps, entree())).toEqual({ ok: false, erreur: "generique" });
    expect(appels.ecritsPublics).toEqual([]);
  });

  it("l'effacement qui échoue ne change pas le résultat", async () => {
    const { deps } = creerTestDependancesCatalogue({ octetsAttente: await jpeg(), erreurSuppression: "TEST_storage" });
    expect((await finaliserPhoto(deps, entree())).ok).toBe(true);
  });

  it("objet d'un autre produit ou mal formé : refusé sans rien lire ni effacer", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ octetsAttente: await jpeg() });
    for (const objet of [`${AUTRE}/11111111-1111-4111-8111-111111111111.jpg`, `${PRODUIT}/../x.jpg`, `${PRODUIT}/11111111-1111-4111-8111-111111111111.gif`, "n-importe-quoi"]) {
      expect(await finaliserPhoto(deps, entree({ objet }))).toEqual({ ok: false, erreur: "format_invalide" });
    }
    expect(appels.ordre.filter((o) => o !== "droit")).toEqual([]);
  });

  it("sans droit : refus avant toute lecture", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ droit: "KS_DROIT_REFUSE", octetsAttente: await jpeg() });
    expect(await finaliserPhoto(deps, entree())).toEqual({ ok: false, erreur: "non_autorise" });
    expect(appels.ordre).toEqual(["droit"]);
  });
});

describe("annulerEnvoiPhoto", () => {
  it("efface l'objet d'attente du produit", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await annulerEnvoiPhoto(deps, { produitId: PRODUIT, objet: OBJET })).toEqual({ ok: true });
    expect(appels.suppressions).toEqual([{ bucket: "galerie-attente", objets: [OBJET] }]);
  });

  it("objet d'un autre produit : refusé, rien n'est effacé", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect((await annulerEnvoiPhoto(deps, { produitId: AUTRE, objet: OBJET })).ok).toBe(false);
    expect(appels.suppressions).toEqual([]);
  });
});

describe("deplacerPhoto", () => {
  it("haut et bas : droit puis écriture avec l'auteur", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await deplacerPhoto(deps, { photoId: PHOTO, sens: "haut" })).toEqual({ ok: true });
    expect(await deplacerPhoto(deps, { photoId: PHOTO, sens: "bas" })).toEqual({ ok: true });
    expect(appels.deplacements.map((d) => d.sens)).toEqual(["haut", "bas"]);
    // Le catalogue public suit l'ordre des photos : l'étiquette est invalidée après la réponse réelle.
    expect(appels.invalidations).toBe(2);
    expect(appels.deplacements[0].auteur).toEqual(AUTEUR);
  });

  it("sens ou identifiant invalide : rien n'est écrit", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect((await deplacerPhoto(deps, { photoId: PHOTO, sens: "milieu" })).ok).toBe(false);
    expect(await deplacerPhoto(deps, { photoId: "x", sens: "haut" })).toEqual({ ok: false, erreur: "photo_introuvable" });
    expect(appels.deplacements).toEqual([]);
  });

  it("refus de la base : erreur rendue ; sans droit : non_autorise", async () => {
    expect(await deplacerPhoto(creerTestDependancesCatalogue({ erreurDeplacer: "KS_PHOTO_INTROUVABLE" }).deps, { photoId: PHOTO, sens: "haut" })).toEqual({ ok: false, erreur: "photo_introuvable" });
    expect(await deplacerPhoto(creerTestDependancesCatalogue({ droit: "KS_DROIT_REFUSE" }).deps, { photoId: PHOTO, sens: "haut" })).toEqual({ ok: false, erreur: "non_autorise" });
  });
});

describe("publierProduit", () => {
  it("produit complet : publié puis étiquette invalidée, dans cet ordre", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await publierProduit(deps, { id: PRODUIT })).toEqual({ ok: true });
    expect(appels.ordre).toEqual(["droit", "publication", "invalidation"]);
    expect(appels.publications).toEqual([{ auteur: AUTEUR, id: PRODUIT, publier: true }]);
  });

  it("incomplet : refusé avec la liste des manques, rien n'est publié ni invalidé", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ produitComplet: { ...TEST_PRODUIT_COMPLET, prixCents: null, nbPhotos: 0 } });
    expect(await publierProduit(deps, { id: PRODUIT })).toEqual({ ok: false, erreur: "publication_incomplete", manques: ["prix", "photo"] });
    expect(appels.publications).toEqual([]);
    expect(appels.invalidations).toBe(0);
  });

  it("la base refuse (état changé entre-temps) : liste relue, pas d'invalidation", async () => {
    let lectures = 0;
    const { deps, appels } = creerTestDependancesCatalogue({
      erreurPublication: "KS_PUBLICATION_INCOMPLETE",
      produitComplet: () => (++lectures === 1 ? TEST_PRODUIT_COMPLET : { ...TEST_PRODUIT_COMPLET, nbVariantes: 0 }),
    });
    expect(await publierProduit(deps, { id: PRODUIT })).toEqual({ ok: false, erreur: "publication_incomplete", manques: ["variante"] });
    expect(appels.invalidations).toBe(0);
  });

  it("erreur de la base : pas de succès, pas d'invalidation", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ erreurPublication: "TEST_panne" });
    expect(await publierProduit(deps, { id: PRODUIT })).toEqual({ ok: false, erreur: "generique" });
    expect(appels.invalidations).toBe(0);
  });

  it("l'invalidation qui échoue n'annule pas la publication réelle", async () => {
    const { deps } = creerTestDependancesCatalogue({ invalidationEnEchec: true });
    expect(await publierProduit(deps, { id: PRODUIT })).toEqual({ ok: true });
  });

  it("produit inconnu, identifiant invalide, sans droit", async () => {
    expect(await publierProduit(creerTestDependancesCatalogue({ produitComplet: null }).deps, { id: PRODUIT })).toEqual({ ok: false, erreur: "produit_introuvable" });
    expect(await publierProduit(creerTestDependancesCatalogue().deps, { id: "x" })).toEqual({ ok: false, erreur: "produit_introuvable" });
    const { deps, appels } = creerTestDependancesCatalogue({ droit: "KS_DROIT_REFUSE" });
    expect(await publierProduit(deps, { id: PRODUIT })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(appels.publications).toEqual([]);
  });
});

describe("depublierProduit", () => {
  it("dépublié puis étiquette invalidée", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await depublierProduit(deps, { id: PRODUIT })).toEqual({ ok: true });
    expect(appels.ordre).toEqual(["droit", "publication", "invalidation"]);
    expect(appels.publications[0].publier).toBe(false);
  });

  it("erreur de la base : pas d'invalidation ; sans droit : refus", async () => {
    const a = creerTestDependancesCatalogue({ erreurPublication: "KS_PRODUIT_INTROUVABLE" });
    expect(await depublierProduit(a.deps, { id: PRODUIT })).toEqual({ ok: false, erreur: "produit_introuvable" });
    expect(a.appels.invalidations).toBe(0);
    expect(await depublierProduit(creerTestDependancesCatalogue({ droit: "KS_DROIT_REFUSE" }).deps, { id: PRODUIT })).toEqual({ ok: false, erreur: "non_autorise" });
  });
});
