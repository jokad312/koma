import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TAILLE_LECTURE_SVG, TAILLE_MAX_FICHIER_KIT, TAILLE_MAX_TRANSCRIPTION } from "@/modules/catalogue/fichiers-kit";
import {
  annulerEnvoiFichierKit,
  demanderEnvoiFichierKit,
  enregistrerKit,
  finaliserFichierKit,
  publierProduit,
  supprimerFichierKit,
} from "@/modules/catalogue/service";
import type { EntreeKit } from "@/modules/catalogue/types";
import { creerTestDependancesCatalogue, TEST_ADMIN_ID, TEST_KIT_ID } from "../doubles/TEST_dependances-catalogue";

// Les tests de Kit lisent par défaut un produit de famille « kit » (le double lit « cosplay » par défaut).
const creer = (r: Parameters<typeof creerTestDependancesCatalogue>[0] = {}) => creerTestDependancesCatalogue({ familleProduit: "kit", ...r });

const AUTRE = "00000000-0000-4000-8000-0000000000cc";
const FICHIER = "00000000-0000-4000-8000-0000000000dd";
const UUID = "11111111-1111-4111-8111-111111111111";
const OBJET_PDF = `${TEST_KIT_ID}/${UUID}.pdf`;
const AUTEUR = { type: "compte", id: TEST_ADMIN_ID, role: "admin" };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const entreeKit = (partiel: Partial<EntreeKit> = {}): EntreeKit => ({
  id: "",
  slug: "test-kit",
  titreFr: "TEST_Kit",
  titreEn: "",
  descriptionFr: "",
  descriptionEn: "",
  materielFr: "",
  materielEn: "",
  universId: "",
  prix: "",
  niveau: "",
  produitLieId: "",
  ...partiel,
});

const octets = (texte: string) => new TextEncoder().encode(texte);
const PDF = octets("%PDF-1.7\n");
const objetPresent = (taille = 3_000_000, debut: Uint8Array = PDF) => ({ trouve: true, taille, debut });

describe("enregistrerKit", () => {
  it("droit d'abord, puis une seule écriture ; prix 0 admis, centimes entiers, famille kit", async () => {
    const { deps, appels } = creer();
    const r = await enregistrerKit(deps, entreeKit({ prix: "0", niveau: "debutant" }));
    expect(r).toEqual({ ok: true, id: "TEST_kit-0001", cree: true });
    expect(appels.ordre).toEqual(["droit", "kit", "invalidation"]);
    expect(appels.droits).toEqual(["produits.modifier"]);
    expect(appels.kits).toHaveLength(1);
    expect(appels.kits[0]).toMatchObject({ auteur: AUTEUR, id: null, kit: { famille: "kit", prix_cents: 0, niveau: "debutant", produit_lie_id: null } });
  });

  it("prix en dollars converti en centimes ; vide = null ; matériel et lien transmis", async () => {
    const { deps, appels } = creer();
    await enregistrerKit(deps, entreeKit({ prix: "9,90", materielFr: " Mousse ", materielEn: "Foam", produitLieId: AUTRE }));
    await enregistrerKit(deps, entreeKit({ prix: "" }));
    expect(appels.kits[0].kit).toMatchObject({ prix_cents: 990, materiel_fr: "Mousse", materiel_en: "Foam", produit_lie_id: AUTRE });
    expect(appels.kits[1].kit.prix_cents).toBeNull();
  });

  it("modification : l'identifiant est transmis, cree: false", async () => {
    const { deps, appels } = creer();
    const r = await enregistrerKit(deps, entreeKit({ id: TEST_KIT_ID }));
    expect(r).toEqual({ ok: true, id: TEST_KIT_ID, cree: false });
    expect(appels.kits[0].id).toBe(TEST_KIT_ID);
  });

  it.each([
    [{ prix: "-1" }, "prix_invalide", "prix"],
    [{ prix: "10000,01" }, "prix_invalide", "prix"],
    [{ prix: "abc" }, "prix_invalide", "prix"],
    [{ prix: "9,999" }, "prix_invalide", "prix"],
    [{ titreFr: "   " }, "titre_invalide", "titre_fr"],
    [{ slug: "Mauvaise Adresse" }, "slug_invalide", "slug"],
    [{ niveau: "expert" }, "niveau_invalide", "niveau"],
    [{ universId: "pas-un-uuid" }, "univers_invalide", "univers"],
    [{ produitLieId: "pas-un-uuid" }, "kit_lie_invalide", "kit_lie"],
    [{ materielFr: "x".repeat(5001) }, "texte_invalide", "materiel_fr"],
    [{ materielEn: "x".repeat(5001) }, "texte_invalide", "materiel_en"],
    [{ descriptionFr: "x".repeat(5001) }, "texte_invalide", "description_fr"],
  ] as const)("%j : %s sur le champ %s, rien n'est écrit", async (partiel, erreur, champ) => {
    const { deps, appels } = creer();
    expect(await enregistrerKit(deps, entreeKit(partiel))).toMatchObject({ ok: false, erreur, champ });
    expect(appels.kits).toEqual([]);
  });

  it("prix 10 000 dollars exactement accepté", async () => {
    const { deps } = creer();
    expect((await enregistrerKit(deps, entreeKit({ prix: "10000" }))).ok).toBe(true);
  });

  it("Assistant ou Compte simple : non_autorise, aucune écriture", async () => {
    const { deps, appels } = creer({ droit: "KS_DROIT_REFUSE" });
    expect(await enregistrerKit(deps, entreeKit())).toMatchObject({ ok: false, erreur: "non_autorise" });
    expect(appels.kits).toEqual([]);
  });

  it("vérification du droit impossible : generique", async () => {
    const { deps } = creer({ droit: "KS_VERIFICATION_IMPOSSIBLE" });
    expect(await enregistrerKit(deps, entreeKit())).toMatchObject({ ok: false, erreur: "generique" });
  });

  it.each([
    ["KS_KIT_LIE_INVALIDE", "kit_lie_invalide", "kit_lie"],
    ["KS_NIVEAU_INVALIDE", "niveau_invalide", "niveau"],
    ["KS_PRIX_INVALIDE", "prix_invalide", "prix"],
    ["KS_UNIVERS_INTROUVABLE", "univers_invalide", "univers"],
    ["KS_PRODUIT_INTROUVABLE", "produit_introuvable", undefined],
    ["KS_FAMILLE_INVALIDE", "famille_invalide", undefined],
    ["KS_DROIT_REFUSE", "non_autorise", undefined],
    ["erreur inconnue", "generique", undefined],
  ])("erreur de la base %s : %s", async (erreurKit, erreur, champ) => {
    const { deps, appels } = creer({ erreurKit });
    expect(await enregistrerKit(deps, entreeKit())).toEqual({ ok: false, erreur, champ });
    expect(appels.invalidations).toBe(0);
  });

  it("adresse prise : erreur sur le champ avec la première adresse libre", async () => {
    const { deps, appels } = creer({ erreurKit: "KS_SLUG_PRIS" });
    expect(await enregistrerKit(deps, entreeKit())).toEqual({ ok: false, erreur: "slug_pris", champ: "slug", slugPropose: "test-kit-2" });
    expect(appels.slugs).toEqual([{ base: "test-kit", exclureId: null }]);
  });

  it("l'invalidation du cache ne se fait qu'après la réponse réelle de la base ; son échec ne défait rien", async () => {
    const { deps, appels } = creer({ invalidationEnEchec: true });
    expect((await enregistrerKit(deps, entreeKit())).ok).toBe(true);
    expect(appels.ordre).toEqual(["droit", "kit", "invalidation"]);
  });

  it("écriture qui lève : generique, jamais un succès", async () => {
    const { deps } = creer();
    (deps.ecrireKit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("TEST_coupure"));
    expect(await enregistrerKit(deps, entreeKit())).toMatchObject({ ok: false, erreur: "generique" });
  });

  it("réponse sans identifiant : generique", async () => {
    const { deps } = creer({ idKit: null });
    expect(await enregistrerKit(deps, entreeKit())).toMatchObject({ ok: false, erreur: "generique" });
  });
});

describe("demanderEnvoiFichierKit", () => {
  const demande = (partiel = {}) => ({ produitId: TEST_KIT_ID, nomFichier: "patron.pdf", format: "pdf_a4", taille: 3_000_000, ...partiel });

  it("droit, Kit puis signature d'un objet choisi par le serveur dans le dossier du Kit", async () => {
    const { deps, appels } = creer();
    const r = await demanderEnvoiFichierKit(deps, demande());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.jeton).toBe("TEST_jeton-kit");
    expect(r.contentType).toBe("application/pdf");
    expect(r.objet).toMatch(new RegExp(`^${TEST_KIT_ID}/[0-9a-f-]{36}\\.pdf$`));
    expect(appels.signaturesKit).toEqual([r.objet]);
    expect(appels.droits).toEqual(["produits.modifier"]);
    expect(appels.ordre).toEqual(["droit", "familleProduit", "signerKit"]);
  });

  it.each([
    ["patron.pdf", "pdf_a4", "pdf", "application/pdf"],
    ["patron.pdf", "pdf_letter", "pdf", "application/pdf"],
    ["motif.svg", "svg", "svg", "image/svg+xml"],
    ["piece.stl", "stl", "stl", "model/stl"],
    ["notes.txt", "transcription", "txt", "text/plain"],
  ])("%s en %s : extension %s", async (nomFichier, format, ext, contentType) => {
    const { deps } = creer();
    const r = await demanderEnvoiFichierKit(deps, demande({ nomFichier, format, taille: 100 }));
    expect(r.ok && r.objet.endsWith(`.${ext}`) && r.contentType === contentType).toBe(true);
  });

  it.each([
    ["setup.exe", "pdf_a4"],
    ["archive.zip", "pdf_a4"],
    ["patron.pdf", "svg"],
    ["patron.pdf", "inconnu"],
  ])("%s en %s : format_invalide, rien n'est signé", async (nomFichier, format) => {
    const { deps, appels } = creer();
    expect(await demanderEnvoiFichierKit(deps, demande({ nomFichier, format }))).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.signaturesKit).toEqual([]);
  });

  it("50 Mo exactement : accepté ; 50 Mo + 1 : fichier_trop_lourd", async () => {
    const { deps, appels } = creer();
    expect((await demanderEnvoiFichierKit(deps, demande({ nomFichier: "a.stl", format: "stl", taille: TAILLE_MAX_FICHIER_KIT }))).ok).toBe(true);
    expect(await demanderEnvoiFichierKit(deps, demande({ nomFichier: "a.stl", format: "stl", taille: TAILLE_MAX_FICHIER_KIT + 1 }))).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(await demanderEnvoiFichierKit(deps, demande({ nomFichier: "a.txt", format: "transcription", taille: TAILLE_MAX_TRANSCRIPTION + 1 }))).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(appels.signaturesKit).toHaveLength(1);
  });

  it("un produit qui n'est pas un Kit : famille_invalide ; inconnu ou mal formé : produit_introuvable", async () => {
    const cosplay = creer({ familleProduit: "cosplay" });
    expect(await demanderEnvoiFichierKit(cosplay.deps, demande())).toEqual({ ok: false, erreur: "famille_invalide" });
    const inconnu = creer({ familleProduit: null });
    expect(await demanderEnvoiFichierKit(inconnu.deps, demande())).toEqual({ ok: false, erreur: "produit_introuvable" });
    expect(await demanderEnvoiFichierKit(inconnu.deps, demande({ produitId: "pas-un-uuid" }))).toEqual({ ok: false, erreur: "produit_introuvable" });
    expect(cosplay.appels.signaturesKit).toEqual([]);
    expect(inconnu.appels.signaturesKit).toEqual([]);
  });

  it("identifiant en majuscules : ramené en minuscules dans le chemin", async () => {
    const { deps } = creer();
    const r = await demanderEnvoiFichierKit(deps, demande({ produitId: TEST_KIT_ID.toUpperCase() }));
    expect(r.ok && r.objet.startsWith(`${TEST_KIT_ID}/`)).toBe(true);
  });

  it("remplacement : le format est celui de la base, pas celui du navigateur", async () => {
    const { deps, appels } = creer({ fichierKit: { produitId: TEST_KIT_ID, format: "svg" } });
    expect(await demanderEnvoiFichierKit(deps, demande({ fichierId: FICHIER, nomFichier: "nouveau.pdf", format: "pdf_a4" }))).toEqual({ ok: false, erreur: "format_invalide" });
    const r = await demanderEnvoiFichierKit(deps, demande({ fichierId: FICHIER, nomFichier: "nouveau.svg", format: "pdf_a4", taille: TAILLE_LECTURE_SVG }));
    expect(r.ok && r.objet.endsWith(".svg")).toBe(true);
    expect(appels.ordre).not.toContain("familleProduit");
  });

  it("remplacement d'un fichier inconnu ou d'un autre Kit : fichier_introuvable", async () => {
    const inconnu = creer({ fichierKit: null });
    expect(await demanderEnvoiFichierKit(inconnu.deps, demande({ fichierId: FICHIER }))).toEqual({ ok: false, erreur: "fichier_introuvable" });
    const autreKit = creer({ fichierKit: { produitId: AUTRE, format: "pdf_a4" } });
    expect(await demanderEnvoiFichierKit(autreKit.deps, demande({ fichierId: FICHIER }))).toEqual({ ok: false, erreur: "fichier_introuvable" });
    expect(await demanderEnvoiFichierKit(inconnu.deps, demande({ fichierId: "pas-un-uuid" }))).toEqual({ ok: false, erreur: "fichier_introuvable" });
    expect(inconnu.appels.signaturesKit).toEqual([]);
    expect(autreKit.appels.signaturesKit).toEqual([]);
  });

  it("sans droit : non_autorise, rien n'est lu ni signé", async () => {
    const { deps, appels } = creer({ droit: "KS_DROIT_REFUSE" });
    expect(await demanderEnvoiFichierKit(deps, demande())).toEqual({ ok: false, erreur: "non_autorise" });
    expect(appels.ordre).toEqual(["droit"]);
  });

  it("échec de la signature ou lecture qui lève : generique", async () => {
    const signature = creer({ erreurSignerKit: "TEST_refus" });
    expect(await demanderEnvoiFichierKit(signature.deps, demande())).toEqual({ ok: false, erreur: "generique" });
    const lecture = creer();
    (lecture.deps.lireFamilleProduit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("TEST_lecture"));
    expect(await demanderEnvoiFichierKit(lecture.deps, demande())).toEqual({ ok: false, erreur: "generique" });
  });
});

describe("finaliserFichierKit", () => {
  const fin = (partiel = {}) => ({
    produitId: TEST_KIT_ID,
    objet: OBJET_PDF,
    format: "pdf_a4",
    taille: 3_000_000,
    nomFr: "Patron A4",
    nomEn: "A4 pattern",
    ...partiel,
  });
  // Chemin choisi par le serveur après la vérification : l'objet y est déplacé, l'ancien chemin (celui du jeton) devient vide.
  const nouveauChemin = (appels: { deplacementsKit: Array<{ de: string; vers: string }> }) => appels.deplacementsKit[0].vers;
  const suppressionsKit = (appels: { suppressions: Array<{ bucket: string; objets: string[] }> }) => appels.suppressions.filter((s) => s.bucket === "kits-private").flatMap((s) => s.objets);

  it("ajout : droit, lecture de l'objet, contenu vérifié, ligne enregistrée, cache vidé ; l'objet est gardé", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent() });
    expect(await finaliserFichierKit(deps, fin())).toEqual({ ok: true, id: "TEST_fichier-0001" });
    expect(appels.ordre).toEqual(["droit", "cheminEnregistre", "lireObjetKit", "deplacer", "fichierKit", "invalidation"]);
    const nouveau = nouveauChemin(appels);
    expect(nouveau).toMatch(new RegExp(`^${TEST_KIT_ID}/[0-9a-f-]{36}\\.pdf$`));
    expect(nouveau).not.toBe(OBJET_PDF);
    expect(appels.deplacementsKit).toEqual([{ de: OBJET_PDF, vers: nouveau }]);
    expect(appels.fichiersKit).toEqual([
      { auteur: AUTEUR, produitId: TEST_KIT_ID, nomFr: "Patron A4", nomEn: "A4 pattern", format: "pdf_a4", taille: 3_000_000, chemin: nouveau },
    ]);
    expect(appels.lecturesObjetKit).toEqual([{ objet: OBJET_PDF, octets: 8 }]);
    expect(appels.suppressions).toEqual([]);
  });

  it("le chemin enregistré est le nouveau chemin choisi par le serveur (jamais celui du jeton) ; les noms sont rognés", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent() });
    await finaliserFichierKit(deps, fin({ nomFr: "  Patron  ", nomEn: " Pattern " }));
    expect(appels.fichiersKit[0]).toMatchObject({ nomFr: "Patron", nomEn: "Pattern", chemin: nouveauChemin(appels) });
    expect(appels.fichiersKit[0].chemin).not.toBe(OBJET_PDF);
  });

  it("double finalisation du même objet (déjà enregistré) : refus clair, rien n'est lu, déplacé ni effacé", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent(), cheminEnregistre: true });
    expect(await finaliserFichierKit(deps, fin())).toEqual({ ok: false, erreur: "fichier_deja_enregistre" });
    expect(appels.ordre).toEqual(["droit", "cheminEnregistre"]);
    expect(appels.suppressions).toEqual([]);
    expect(appels.fichiersKit).toEqual([]);
  });

  it("lecture des chemins enregistrés en erreur : generique, rien n'est effacé", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent(), cheminKitEnregistreLeve: true });
    expect(await finaliserFichierKit(deps, fin())).toEqual({ ok: false, erreur: "generique" });
    expect(appels.suppressions).toEqual([]);
  });

  it("déplacement en échec : generique, l'objet d'origine (non référencé) est effacé, rien d'enregistré", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent(), erreurDeplacerObjet: "TEST_stockage" });
    expect(await finaliserFichierKit(deps, fin())).toEqual({ ok: false, erreur: "generique" });
    expect(appels.fichiersKit).toEqual([]);
    expect(suppressionsKit(appels)).toEqual([OBJET_PDF]);
  });

  it("l'objet vérifié n'est jamais effacé après un succès : l'ancien chemin est seulement vidé par le déplacement", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent() });
    await finaliserFichierKit(deps, fin());
    expect(appels.suppressions).toEqual([]);
  });

  it("SVG avec contenu actif : contenu_actif, objet effacé ; en-tête illisible : entete_illisible", async () => {
    const objet = `${TEST_KIT_ID}/${UUID}.svg`;
    const actif = octets('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const a = creer({ objetKit: objetPresent(actif.length, actif) });
    expect(await finaliserFichierKit(a.deps, fin({ objet, format: "svg", taille: actif.length }))).toEqual({ ok: false, erreur: "contenu_actif" });
    expect(suppressionsKit(a.appels)).toEqual([objet]);
    expect(a.appels.deplacementsKit).toEqual([]);
    const illisible = new Uint8Array([0xff, 0xfe, 0x3c, 0x00, 0x73, 0x00]);
    const b = creer({ objetKit: objetPresent(illisible.length, illisible) });
    expect(await finaliserFichierKit(b.deps, fin({ objet, format: "svg", taille: illisible.length }))).toEqual({ ok: false, erreur: "entete_illisible" });
  });

  it("un .pdf qui contient du texte : format_invalide, objet effacé, rien d'enregistré", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent(7, octets("Bonjour")) });
    expect(await finaliserFichierKit(deps, fin({ taille: 7 }))).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.fichiersKit).toEqual([]);
    expect(suppressionsKit(appels)).toEqual([OBJET_PDF]);
    expect(appels.invalidations).toBe(0);
  });

  it("objet absent : envoi_incomplet ; taille réelle différente de l'annoncée : envoi_incomplet", async () => {
    const absent = creer();
    expect(await finaliserFichierKit(absent.deps, fin())).toEqual({ ok: false, erreur: "envoi_incomplet" });
    expect(absent.appels.fichiersKit).toEqual([]);
    const different = creer({ objetKit: objetPresent(2_999_999) });
    expect(await finaliserFichierKit(different.deps, fin())).toEqual({ ok: false, erreur: "envoi_incomplet" });
    expect(suppressionsKit(different.appels)).toEqual([OBJET_PDF]);
  });

  it("taille annoncée trop grande ou réelle trop grande : fichier_trop_lourd, objet effacé", async () => {
    const annoncee = creer({ objetKit: objetPresent() });
    expect(await finaliserFichierKit(annoncee.deps, fin({ taille: TAILLE_MAX_FICHIER_KIT + 1 }))).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(annoncee.appels.ordre).not.toContain("lireObjetKit");
    expect(suppressionsKit(annoncee.appels)).toEqual([OBJET_PDF]);
    const reelle = creer({ objetKit: objetPresent(TAILLE_MAX_FICHIER_KIT + 10) });
    expect(await finaliserFichierKit(reelle.deps, fin({ taille: 3_000_000 }))).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(reelle.appels.fichiersKit).toEqual([]);
  });

  it("transcription : l'objet est lu en entier", async () => {
    const texte = octets("Une transcription en français : été.");
    const objet = `${TEST_KIT_ID}/${UUID}.txt`;
    const { deps, appels } = creer({ objetKit: objetPresent(texte.length, texte) });
    expect((await finaliserFichierKit(deps, fin({ objet, format: "transcription", taille: texte.length }))).ok).toBe(true);
    expect(appels.lecturesObjetKit).toEqual([{ objet, octets: texte.length }]);
  });

  it("noms vides ou trop longs : nom_invalide, objet effacé, rien d'enregistré", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent() });
    expect(await finaliserFichierKit(deps, fin({ nomFr: "   " }))).toEqual({ ok: false, erreur: "nom_invalide" });
    expect(await finaliserFichierKit(deps, fin({ nomEn: "x".repeat(121) }))).toEqual({ ok: false, erreur: "nom_invalide" });
    expect(appels.fichiersKit).toEqual([]);
    expect(suppressionsKit(appels)).toEqual([OBJET_PDF, OBJET_PDF]);
  });

  it("un objet d'un autre Kit ou d'une autre extension n'est ni lu ni effacé", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent() });
    expect(await finaliserFichierKit(deps, fin({ objet: `${AUTRE}/${UUID}.pdf` }))).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await finaliserFichierKit(deps, fin({ objet: `${TEST_KIT_ID}/${UUID}.svg` }))).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await finaliserFichierKit(deps, fin({ format: "exe" }))).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.ordre).toEqual(["droit", "droit", "droit"]);
    expect(appels.suppressions).toEqual([]);
  });

  it("la base refuse : l'erreur est rendue et l'objet est effacé APRÈS l'écriture ratée", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent(), erreurFichierKit: "KS_NOM_INVALIDE" });
    expect(await finaliserFichierKit(deps, fin())).toEqual({ ok: false, erreur: "nom_invalide" });
    expect(appels.ordre).toEqual(["droit", "cheminEnregistre", "lireObjetKit", "deplacer", "fichierKit", "supprimer:kits-private"]);
    expect(suppressionsKit(appels)).toEqual([nouveauChemin(appels)]);
    expect(appels.invalidations).toBe(0);
  });

  it.each([
    ["KS_PRODUIT_INTROUVABLE", "produit_introuvable"],
    ["KS_FAMILLE_INVALIDE", "famille_invalide"],
    ["KS_FORMAT_INVALIDE", "format_invalide"],
    ["KS_TAILLE_FICHIER_INVALIDE", "fichier_trop_lourd"],
    ["KS_CHEMIN_INVALIDE", "fichier_deja_enregistre"],
    ["KS_DROIT_REFUSE", "non_autorise"],
  ])("erreur de la base %s : %s", async (erreurFichierKit, erreur) => {
    const { deps } = creer({ objetKit: objetPresent(), erreurFichierKit });
    expect(await finaliserFichierKit(deps, fin())).toEqual({ ok: false, erreur });
  });

  it("KS_CHEMIN_INVALIDE de la base : l'objet n'est pas effacé (il est peut-être référencé)", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent(), erreurFichierKit: "KS_CHEMIN_INVALIDE" });
    await finaliserFichierKit(deps, fin());
    expect(appels.suppressions).toEqual([]);
  });

  it("l'écriture lève : résultat inconnu, l'objet est gardé (un orphelin vaut mieux qu'un fichier cassé)", async () => {
    const { deps, appels } = creer({ objetKit: objetPresent(), leveFichierKit: true });
    expect(await finaliserFichierKit(deps, fin())).toEqual({ ok: false, erreur: "generique" });
    expect(appels.suppressions).toEqual([]);
  });

  it("lecture de l'objet en erreur : generique, objet conservé (l'erreur ne refuse pas le fichier)", async () => {
    const { deps, appels } = creer({ erreurLectureObjetKit: "TEST_stockage" });
    expect(await finaliserFichierKit(deps, fin())).toEqual({ ok: false, erreur: "generique" });
    expect(suppressionsKit(appels)).toEqual([]);
  });

  it("sans droit : rien n'est lu ni écrit", async () => {
    const { deps, appels } = creer({ droit: "KS_DROIT_REFUSE", objetKit: objetPresent() });
    expect(await finaliserFichierKit(deps, fin())).toEqual({ ok: false, erreur: "non_autorise" });
    expect(appels.ordre).toEqual(["droit"]);
    expect(appels.suppressions).toEqual([]);
  });

  describe("remplacement", () => {
    const remplace = (partiel = {}) => fin({ fichierId: FICHIER, nomFr: "", nomEn: "", ...partiel });

    it("la base d'abord (version + 1), l'ancien objet effacé APRÈS, l'objet neuf gardé", async () => {
      const { deps, appels } = creer({ objetKit: objetPresent(), ancienChemin: `${TEST_KIT_ID}/ancien.pdf` });
      expect(await finaliserFichierKit(deps, remplace())).toEqual({ ok: true, id: FICHIER });
      expect(appels.ordre).toEqual(["droit", "lireFichierKit", "cheminEnregistre", "lireObjetKit", "deplacer", "remplacerFichierKit", "supprimer:kits-private", "invalidation"]);
      expect(appels.remplacementsKit).toEqual([{ auteur: AUTEUR, fichierId: FICHIER, taille: 3_000_000, chemin: nouveauChemin(appels) }]);
      expect(suppressionsKit(appels)).toEqual([`${TEST_KIT_ID}/ancien.pdf`]);
      expect(appels.fichiersKit).toEqual([]);
    });

    it("le format vient de la base : un PDF ne remplace pas un SVG", async () => {
      const { deps, appels } = creer({ objetKit: objetPresent(), fichierKit: { produitId: TEST_KIT_ID, format: "svg" } });
      expect(await finaliserFichierKit(deps, remplace({ format: "pdf_a4" }))).toEqual({ ok: false, erreur: "format_invalide" });
      expect(appels.remplacementsKit).toEqual([]);
      expect(appels.suppressions).toEqual([]);
    });

    it("remplacement par le chemin courant (objet déjà enregistré) : refus, rien n'est effacé, l'objet reste", async () => {
      const { deps, appels } = creer({ objetKit: objetPresent(), cheminEnregistre: true });
      expect(await finaliserFichierKit(deps, remplace())).toEqual({ ok: false, erreur: "fichier_deja_enregistre" });
      expect(appels.suppressions).toEqual([]);
      expect(appels.remplacementsKit).toEqual([]);
    });

    it("la base refuse : le nouvel objet est effacé, l'ancien est conservé", async () => {
      const { deps, appels } = creer({ objetKit: objetPresent(), erreurRemplacerFichier: "KS_FICHIER_INTROUVABLE" });
      expect(await finaliserFichierKit(deps, remplace())).toEqual({ ok: false, erreur: "fichier_introuvable" });
      expect(suppressionsKit(appels)).toEqual([nouveauChemin(appels)]);
      expect(appels.invalidations).toBe(0);
    });

    it("un échec d'effacement de l'ancien objet est journalisé, jamais bloquant", async () => {
      const { deps, appels } = creer({ objetKit: objetPresent(), erreurSuppression: "TEST_stockage" });
      expect(await finaliserFichierKit(deps, remplace())).toEqual({ ok: true, id: FICHIER });
      expect(appels.invalidations).toBe(1);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("nettoyage kits-private"));
    });

    it("l'écriture lève : résultat inconnu, aucun objet n'est effacé", async () => {
      const { deps, appels } = creer({ objetKit: objetPresent(), leveRemplacerFichier: true });
      expect(await finaliserFichierKit(deps, remplace())).toEqual({ ok: false, erreur: "generique" });
      expect(appels.suppressions).toEqual([]);
    });

    it("fichier inconnu ou d'un autre Kit : fichier_introuvable, rien n'est lu ni effacé", async () => {
      const inconnu = creer({ fichierKit: null, objetKit: objetPresent() });
      expect(await finaliserFichierKit(inconnu.deps, remplace())).toEqual({ ok: false, erreur: "fichier_introuvable" });
      const autre = creer({ fichierKit: { produitId: AUTRE, format: "pdf_a4" }, objetKit: objetPresent() });
      expect(await finaliserFichierKit(autre.deps, remplace())).toEqual({ ok: false, erreur: "fichier_introuvable" });
      expect(inconnu.appels.suppressions).toEqual([]);
      expect(autre.appels.suppressions).toEqual([]);
    });

    it("contenu incohérent : format_invalide, nouvel objet effacé, version inchangée", async () => {
      const { deps, appels } = creer({ objetKit: objetPresent(7, octets("Bonjour")) });
      expect(await finaliserFichierKit(deps, remplace({ taille: 7 }))).toEqual({ ok: false, erreur: "format_invalide" });
      expect(appels.remplacementsKit).toEqual([]);
      expect(suppressionsKit(appels)).toEqual([OBJET_PDF]);
    });
  });
});

describe("publication d'un Kit", () => {
  it("publierProduit d'un Kit : kit_non_publiable, la base n'est pas appelée", async () => {
    const { deps, appels } = creer();
    expect(await publierProduit(deps, { id: TEST_KIT_ID })).toEqual({ ok: false, erreur: "kit_non_publiable" });
    expect(appels.publications).toEqual([]);
  });
});

describe("annulerEnvoiFichierKit", () => {
  it("efface l'objet de ce Kit seulement", async () => {
    const { deps, appels } = creer();
    expect(await annulerEnvoiFichierKit(deps, { produitId: TEST_KIT_ID, objet: OBJET_PDF })).toEqual({ ok: true });
    expect(appels.suppressions).toEqual([{ bucket: "kits-private", objets: [OBJET_PDF] }]);
    expect(await annulerEnvoiFichierKit(deps, { produitId: TEST_KIT_ID, objet: `${AUTRE}/${UUID}.pdf` })).toEqual({ ok: false, erreur: "produit_introuvable" });
    expect(await annulerEnvoiFichierKit(deps, { produitId: "pas-un-uuid", objet: OBJET_PDF })).toEqual({ ok: false, erreur: "produit_introuvable" });
    expect(appels.suppressions).toHaveLength(1);
  });

  it("un objet déjà enregistré en base n'est jamais effacé par une annulation", async () => {
    const { deps, appels } = creer({ cheminEnregistre: true });
    expect(await annulerEnvoiFichierKit(deps, { produitId: TEST_KIT_ID, objet: OBJET_PDF })).toEqual({ ok: false, erreur: "fichier_deja_enregistre" });
    expect(appels.suppressions).toEqual([]);
    const panne = creer({ cheminKitEnregistreLeve: true });
    expect(await annulerEnvoiFichierKit(panne.deps, { produitId: TEST_KIT_ID, objet: OBJET_PDF })).toEqual({ ok: false, erreur: "generique" });
    expect(panne.appels.suppressions).toEqual([]);
  });

  it("sans droit : rien n'est effacé", async () => {
    const { deps, appels } = creer({ droit: "KS_DROIT_REFUSE" });
    expect(await annulerEnvoiFichierKit(deps, { produitId: TEST_KIT_ID, objet: OBJET_PDF })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(appels.suppressions).toEqual([]);
  });
});

describe("supprimerFichierKit", () => {
  it("la base d'abord (lignes et journal), puis l'objet, puis le cache", async () => {
    const { deps, appels } = creer({ cheminSupprime: `${TEST_KIT_ID}/a.pdf` });
    expect(await supprimerFichierKit(deps, { fichierId: FICHIER })).toEqual({ ok: true });
    expect(appels.ordre).toEqual(["droit", "supprimerFichierKit", "supprimer:kits-private", "invalidation"]);
    expect(appels.suppressionsFichierKit).toEqual([{ auteur: AUTEUR, fichierId: FICHIER }]);
    expect(appels.suppressions).toEqual([{ bucket: "kits-private", objets: [`${TEST_KIT_ID}/a.pdf`] }]);
  });

  it("la base refuse : rien n'est effacé du stockage", async () => {
    const { deps, appels } = creer({ erreurSupprimerFichier: "KS_FICHIER_INTROUVABLE" });
    expect(await supprimerFichierKit(deps, { fichierId: FICHIER })).toEqual({ ok: false, erreur: "fichier_introuvable" });
    expect(appels.suppressions).toEqual([]);
    expect(appels.invalidations).toBe(0);
  });

  it("un échec d'effacement du stockage est journalisé, la suppression en base reste valable", async () => {
    const { deps } = creer({ erreurSuppression: "TEST_stockage" });
    expect(await supprimerFichierKit(deps, { fichierId: FICHIER })).toEqual({ ok: true });
  });

  it("identifiant mal formé : fichier_introuvable ; sans droit : non_autorise", async () => {
    const a = creer();
    expect(await supprimerFichierKit(a.deps, { fichierId: "pas-un-uuid" })).toEqual({ ok: false, erreur: "fichier_introuvable" });
    expect(a.appels.suppressionsFichierKit).toEqual([]);
    const b = creer({ droit: "KS_DROIT_REFUSE" });
    expect(await supprimerFichierKit(b.deps, { fichierId: FICHIER })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(b.appels.ordre).toEqual(["droit"]);
  });
});
