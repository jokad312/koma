import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerUnivers, enregistrerProduit } from "@/modules/catalogue/service";
import type { EntreeProduit } from "@/modules/catalogue/types";
import { creerTestDependancesCatalogue, TEST_ADMIN_ID } from "../doubles/TEST_dependances-catalogue";

const UNIVERS = "00000000-0000-4000-8000-0000000000aa";
const PRODUIT = "00000000-0000-4000-8000-0000000000bb";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function entree(partiel: Partial<EntreeProduit> = {}): EntreeProduit {
  return {
    id: "",
    famille: "cosplay",
    slug: "cosplay-de-test",
    titreFr: "Cosplay de test",
    titreEn: "",
    descriptionFr: "",
    descriptionEn: "",
    universId: "",
    prix: "",
    delai: "",
    variantes: [],
    ...partiel,
  };
}

describe("creerUnivers", () => {
  it("noms rognés, droit d'abord, écriture avec l'auteur issu de la session", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await creerUnivers(deps, { nomFr: "  Nom FR  ", nomEn: " Nom EN " })).toEqual({ ok: true, id: "TEST_univers-0001" });
    expect(appels.ordre).toEqual(["droit", "univers"]);
    expect(appels.droits).toEqual(["produits.modifier"]);
    expect(appels.univers).toEqual([{ auteur: { type: "compte", id: TEST_ADMIN_ID, role: "admin" }, nomFr: "Nom FR", nomEn: "Nom EN" }]);
  });

  it.each([
    [{ nomFr: "   ", nomEn: "x" }, "nom_fr"],
    [{ nomFr: "x", nomEn: "" }, "nom_en"],
    [{ nomFr: "x".repeat(61), nomEn: "x" }, "nom_fr"],
    [{ nomFr: "x", nomEn: "x".repeat(61) }, "nom_en"],
  ])("nom invalide %#: refusé sur le bon champ, rien n'est écrit", async (saisie, champ) => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await creerUnivers(deps, saisie)).toEqual({ ok: false, erreur: "nom_invalide", champ });
    expect(appels.univers).toEqual([]);
  });

  it("60 caractères : accepté", async () => {
    const { deps } = creerTestDependancesCatalogue();
    expect((await creerUnivers(deps, { nomFr: "x".repeat(60), nomEn: "y".repeat(60) })).ok).toBe(true);
  });

  it("doublon : univers_existe", async () => {
    const { deps } = creerTestDependancesCatalogue({ erreurUnivers: "KS_UNIVERS_EXISTE" });
    expect(await creerUnivers(deps, { nomFr: "a", nomEn: "b" })).toEqual({ ok: false, erreur: "univers_existe" });
  });

  it("droit refusé (Assistant, Compte simple, visiteur) : le droit passe avant tout, rien n'est écrit", async () => {
    for (const droit of ["KS_NON_CONNECTE", "KS_DROIT_REFUSE"] as const) {
      const { deps, appels } = creerTestDependancesCatalogue({ droit });
      expect(await creerUnivers(deps, { nomFr: "a", nomEn: "b" })).toEqual({ ok: false, erreur: "non_autorise" });
      expect(appels.univers).toEqual([]);
    }
  });

  it("vérification du droit impossible : erreur générique, jamais une ouverture", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ droit: "KS_VERIFICATION_IMPOSSIBLE" });
    expect(await creerUnivers(deps, { nomFr: "a", nomEn: "b" })).toEqual({ ok: false, erreur: "generique" });
    expect(appels.univers).toEqual([]);
  });

  it("refus de la base sur le droit : non_autorise ; autre échec ou exception : générique", async () => {
    expect(await creerUnivers(creerTestDependancesCatalogue({ erreurUnivers: "KS_DROIT_REFUSE" }).deps, { nomFr: "a", nomEn: "b" })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await creerUnivers(creerTestDependancesCatalogue({ erreurUnivers: "boom" }).deps, { nomFr: "a", nomEn: "b" })).toEqual({ ok: false, erreur: "generique" });
    const { deps } = creerTestDependancesCatalogue();
    vi.mocked(deps.ecrireUnivers).mockRejectedValueOnce(new Error("TEST_reseau"));
    expect(await creerUnivers(deps, { nomFr: "a", nomEn: "b" })).toEqual({ ok: false, erreur: "generique" });
  });

  it("réponse sans identifiant : pas de succès", async () => {
    const { deps } = creerTestDependancesCatalogue({ idUnivers: null });
    expect(await creerUnivers(deps, { nomFr: "a", nomEn: "b" })).toEqual({ ok: false, erreur: "generique" });
  });
});

describe("enregistrerProduit", () => {
  it("création d'un cosplay : prix 49,90 devient 4990 centimes, variantes converties, droit puis écriture", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    const r = await enregistrerProduit(
      deps,
      entree({
        prix: "49,90",
        delai: "14",
        universId: UNIVERS,
        titreEn: " Test costume ",
        variantes: [
          { taille: "M", stock: "2", surCommande: false, delai: "" },
          { taille: "sur_mesure", stock: "9", surCommande: false, delai: "" },
        ],
      }),
    );
    expect(r).toEqual({ ok: true, id: "TEST_produit-0001", cree: true });
    expect(appels.ordre).toEqual(["droit", "produit", "invalidation"]);
    expect(appels.droits).toEqual(["produits.modifier"]);
    expect(appels.produits).toEqual([
      {
        auteur: { type: "compte", id: TEST_ADMIN_ID, role: "admin" },
        id: null,
        produit: {
          famille: "cosplay",
          slug: "cosplay-de-test",
          titre_fr: "Cosplay de test",
          titre_en: "Test costume",
          description_fr: null,
          description_en: null,
          univers_id: UNIVERS,
          prix_cents: 4990,
          delai_fabrication_jours: 14,
        },
        variantes: [
          { taille: "M", stock: 2, fabrication_sur_commande: false, delai_fabrication_jours: null },
          // Sur-mesure : toujours fabriqué, stock 0, quoi que le navigateur envoie.
          { taille: "sur_mesure", stock: 0, fabrication_sur_commande: true, delai_fabrication_jours: null },
        ],
      },
    ]);
  });

  it("un brouillon peut être incomplet : ni prix, ni univers, ni variante", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect((await enregistrerProduit(deps, entree())).ok).toBe(true);
    expect(appels.produits[0].produit).toMatchObject({ prix_cents: null, univers_id: null, delai_fabrication_jours: null });
    expect(appels.produits[0].variantes).toEqual([]);
  });

  it("modification : l'identifiant est transmis, cree vaut faux", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await enregistrerProduit(deps, entree({ id: PRODUIT }))).toEqual({ ok: true, id: PRODUIT, cree: false });
    expect(appels.produits[0].id).toBe(PRODUIT);
  });

  it.each([
    ["0", "prix_invalide"],
    ["-3", "prix_invalide"],
    ["12,345", "prix_invalide"],
    ["abc", "prix_invalide"],
  ])("prix « %s » : refusé sur le champ, rien n'est écrit", async (prix, erreur) => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await enregistrerProduit(deps, entree({ prix }))).toEqual({ ok: false, erreur, champ: "prix", taille: undefined });
    expect(appels.produits).toEqual([]);
  });

  it.each([
    [{ famille: "kit" }, "famille_invalide", "famille"],
    [{ famille: "" }, "famille_invalide", "famille"],
    [{ titreFr: "  " }, "titre_invalide", "titre_fr"],
    [{ titreFr: "x".repeat(121) }, "titre_invalide", "titre_fr"],
    [{ slug: "Pas Bon" }, "slug_invalide", "slug"],
    [{ slug: "" }, "slug_invalide", "slug"],
    [{ delai: "0" }, "delai_invalide", "delai"],
    [{ delai: "366" }, "delai_invalide", "delai"],
    [{ delai: "2,5" }, "delai_invalide", "delai"],
    [{ universId: "pas-un-identifiant" }, "univers_invalide", "univers"],
    [{ descriptionFr: "x".repeat(5001) }, "texte_invalide", "description_fr"],
  ] as const)("saisie invalide %#: refusée sur le champ concerné, rien n'est écrit", async (partiel, erreur, champ) => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await enregistrerProduit(deps, entree(partiel as Partial<EntreeProduit>))).toMatchObject({ ok: false, erreur, champ });
    expect(appels.produits).toEqual([]);
  });

  it("Sur-mesure sur un accessoire : refusé", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await enregistrerProduit(deps, entree({ famille: "accessoire", variantes: [{ taille: "sur_mesure", stock: "0", surCommande: true, delai: "5" }] }))).toEqual({
      ok: false,
      erreur: "taille_invalide",
      champ: "variantes",
      taille: "sur_mesure",
    });
    expect(appels.produits).toEqual([]);
  });

  it("taille inconnue ou répétée : refusée", async () => {
    const { deps } = creerTestDependancesCatalogue();
    expect(await enregistrerProduit(deps, entree({ variantes: [{ taille: "XXXL", stock: "1", surCommande: false, delai: "" }] }))).toMatchObject({ erreur: "taille_invalide" });
    expect(
      await enregistrerProduit(
        deps,
        entree({
          variantes: [
            { taille: "M", stock: "1", surCommande: false, delai: "" },
            { taille: "M", stock: "2", surCommande: false, delai: "" },
          ],
        }),
      ),
    ).toMatchObject({ erreur: "taille_invalide", taille: "M" });
  });

  it.each(["-1", "2,5", "2.5", "", "abc"])("stock « %s » : refusé sur la taille", async (stock) => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await enregistrerProduit(deps, entree({ variantes: [{ taille: "S", stock, surCommande: false, delai: "" }] }))).toEqual({
      ok: false,
      erreur: "stock_invalide",
      champ: "variantes",
      taille: "S",
    });
    expect(appels.produits).toEqual([]);
  });

  it("fabrication sur commande sans délai (ni variante, ni produit) : refusée sur la taille", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await enregistrerProduit(deps, entree({ variantes: [{ taille: "L", stock: "0", surCommande: true, delai: "" }] }))).toEqual({
      ok: false,
      erreur: "delai_manquant",
      champ: "variantes",
      taille: "L",
    });
    expect(appels.produits).toEqual([]);
  });

  it("fabrication sur commande : le délai du produit suffit, celui de la variante le remplace", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect((await enregistrerProduit(deps, entree({ delai: "10", variantes: [{ taille: "L", stock: "0", surCommande: true, delai: "" }] }))).ok).toBe(true);
    expect((await enregistrerProduit(deps, entree({ variantes: [{ taille: "L", stock: "0", surCommande: true, delai: "20" }] }))).ok).toBe(true);
    expect(appels.produits[1].variantes).toEqual([{ taille: "L", stock: 0, fabrication_sur_commande: true, delai_fabrication_jours: 20 }]);
  });

  it("Sur-mesure sans aucun délai : refusé (toujours en fabrication)", async () => {
    const { deps } = creerTestDependancesCatalogue();
    expect(await enregistrerProduit(deps, entree({ variantes: [{ taille: "sur_mesure", stock: "0", surCommande: false, delai: "" }] }))).toMatchObject({
      erreur: "delai_manquant",
      taille: "sur_mesure",
    });
  });

  it("adresse déjà prise : erreur sur le champ avec la première adresse libre", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ erreurProduit: "KS_SLUG_PRIS", slugLibre: "cosplay-de-test-2" });
    expect(await enregistrerProduit(deps, entree({ id: PRODUIT }))).toEqual({ ok: false, erreur: "slug_pris", champ: "slug", slugPropose: "cosplay-de-test-2" });
    expect(appels.slugs).toEqual([{ base: "cosplay-de-test", exclureId: PRODUIT }]);
  });

  it("adresse déjà prise et lecture des adresses impossible : l'erreur reste sans proposition", async () => {
    const { deps } = creerTestDependancesCatalogue({ erreurProduit: "KS_SLUG_PRIS", slugLibre: "erreur" });
    expect(await enregistrerProduit(deps, entree())).toEqual({ ok: false, erreur: "slug_pris", champ: "slug", slugPropose: undefined });
  });

  it.each([
    ["KS_FAMILLE_INVALIDE", "famille_invalide", "famille"],
    ["KS_PRIX_INVALIDE", "prix_invalide", "prix"],
    ["KS_STOCK_INVALIDE", "stock_invalide", "variantes"],
    ["KS_DELAI_MANQUANT", "delai_manquant", "variantes"],
    ["KS_TAILLE_INVALIDE", "taille_invalide", "variantes"],
    ["KS_UNIVERS_INTROUVABLE", "univers_invalide", "univers"],
    ["KS_PUBLICATION_INCOMPLETE", "publication_incomplete", undefined],
    ["KS_PRODUIT_PUBLIE_VERROUILLE", "produit_publie_verrouille", undefined],
  ])("la base refuse (%s) : même erreur côté interface", async (code, erreur, champ) => {
    const { deps } = creerTestDependancesCatalogue({ erreurProduit: code });
    expect(await enregistrerProduit(deps, entree())).toEqual({ ok: false, erreur, champ });
  });

  it("un refus de la base n'invalide pas l'étiquette du catalogue", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ erreurProduit: "KS_PUBLICATION_INCOMPLETE" });
    await enregistrerProduit(deps, entree());
    expect(appels.invalidations).toBe(0);
  });

  it("produit introuvable, droit refusé par la base, échec inconnu", async () => {
    expect(await enregistrerProduit(creerTestDependancesCatalogue({ erreurProduit: "KS_PRODUIT_INTROUVABLE" }).deps, entree({ id: PRODUIT }))).toEqual({
      ok: false,
      erreur: "produit_introuvable",
      champ: undefined,
    });
    expect(await enregistrerProduit(creerTestDependancesCatalogue({ erreurProduit: "KS_DROIT_REFUSE" }).deps, entree())).toMatchObject({ ok: false, erreur: "non_autorise" });
    expect(await enregistrerProduit(creerTestDependancesCatalogue({ erreurProduit: "boom" }).deps, entree())).toEqual({ ok: false, erreur: "generique" });
  });

  it("droit refusé : le droit passe avant la validation, rien n'est écrit", async () => {
    for (const droit of ["KS_NON_CONNECTE", "KS_DROIT_REFUSE"] as const) {
      const { deps, appels } = creerTestDependancesCatalogue({ droit });
      expect(await enregistrerProduit(deps, entree({ famille: "kit" }))).toEqual({ ok: false, erreur: "non_autorise" });
      expect(appels.ordre).toEqual(["droit"]);
      expect(appels.produits).toEqual([]);
    }
  });

  it("exception ou réponse sans identifiant : jamais de succès", async () => {
    const a = creerTestDependancesCatalogue();
    vi.mocked(a.deps.ecrireProduit).mockRejectedValueOnce(new Error("TEST_reseau"));
    expect(await enregistrerProduit(a.deps, entree())).toEqual({ ok: false, erreur: "generique" });
    const b = creerTestDependancesCatalogue({ idProduit: null });
    expect(await enregistrerProduit(b.deps, entree())).toEqual({ ok: false, erreur: "generique" });
  });

  it("n'envoie jamais de date de publication : la publication est la story 2.2", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    await enregistrerProduit(deps, { ...entree(), publieLe: "2026-01-01" } as EntreeProduit);
    expect(JSON.stringify(appels.produits)).not.toContain("publie");
  });
});
