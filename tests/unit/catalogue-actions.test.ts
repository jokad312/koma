import { beforeEach, describe, expect, it, vi } from "vitest";
import { creerTestDependancesCatalogue } from "../doubles/TEST_dependances-catalogue";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({ courant: null as unknown }));
vi.mock("@/modules/catalogue/dependances", () => ({
  dependances: () => {
    if (faux.courant instanceof Error) throw faux.courant;
    return faux.courant;
  },
}));

import { creerUnivers, enregistrerProduit } from "@/modules/catalogue/actions";

const ENTREE = {
  id: "",
  famille: "accessoire",
  slug: "accessoire-de-test",
  titreFr: "Accessoire de test",
  titreEn: "",
  descriptionFr: "",
  descriptionEn: "",
  universId: "",
  prix: "12,50",
  delai: "",
  variantes: [{ taille: "S", stock: "3", surCommande: false, delai: "" }],
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Server Action creerUnivers", () => {
  it("succès : rendu seulement après la réponse de la base", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    faux.courant = deps;
    expect(await creerUnivers({ nomFr: "A", nomEn: "B" })).toEqual({ statut: "succes" });
    expect(appels.ordre).toEqual(["droit", "univers"]);
  });

  it("échec : aucun succès, l'erreur est rendue avec son champ", async () => {
    faux.courant = creerTestDependancesCatalogue().deps;
    expect(await creerUnivers({ nomFr: "", nomEn: "B" })).toEqual({ statut: "erreur", erreur: "nom_invalide", champ: "nom_fr" });
    faux.courant = creerTestDependancesCatalogue({ erreurUnivers: "KS_UNIVERS_EXISTE" }).deps;
    expect(await creerUnivers({ nomFr: "A", nomEn: "B" })).toMatchObject({ statut: "erreur", erreur: "univers_existe" });
  });

  it("exception inattendue : erreur générique, jamais un succès", async () => {
    faux.courant = new Error("TEST_panne");
    expect(await creerUnivers({ nomFr: "A", nomEn: "B" })).toEqual({ statut: "erreur", erreur: "generique" });
  });

  it("droit refusé : non_autorise", async () => {
    faux.courant = creerTestDependancesCatalogue({ droit: "KS_DROIT_REFUSE" }).deps;
    expect(await creerUnivers({ nomFr: "A", nomEn: "B" })).toMatchObject({ statut: "erreur", erreur: "non_autorise" });
  });
});

describe("Server Action enregistrerProduit", () => {
  it("création : succès avec l'identifiant et cree vrai", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    faux.courant = deps;
    expect(await enregistrerProduit(ENTREE)).toEqual({ statut: "succes", id: "TEST_produit-0001", cree: true });
    expect(appels.produits[0].produit.prix_cents).toBe(1250);
  });

  it("échec de validation : erreur, champ et taille rendus, rien d'écrit", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    faux.courant = deps;
    expect(await enregistrerProduit({ ...ENTREE, variantes: [{ taille: "S", stock: "-1", surCommande: false, delai: "" }] })).toMatchObject({
      statut: "erreur",
      erreur: "stock_invalide",
      champ: "variantes",
      taille: "S",
    });
    expect(appels.produits).toEqual([]);
  });

  it("adresse prise : la proposition est rendue", async () => {
    faux.courant = creerTestDependancesCatalogue({ erreurProduit: "KS_SLUG_PRIS", slugLibre: "accessoire-de-test-2" }).deps;
    expect(await enregistrerProduit(ENTREE)).toMatchObject({ statut: "erreur", erreur: "slug_pris", champ: "slug", slugPropose: "accessoire-de-test-2" });
  });

  it("exception inattendue : erreur générique, jamais un succès", async () => {
    faux.courant = new Error("TEST_panne");
    expect(await enregistrerProduit(ENTREE)).toEqual({ statut: "erreur", erreur: "generique" });
  });

  it("Assistant ou Compte simple : refus serveur", async () => {
    faux.courant = creerTestDependancesCatalogue({ droit: "KS_DROIT_REFUSE" }).deps;
    expect(await enregistrerProduit(ENTREE)).toMatchObject({ statut: "erreur", erreur: "non_autorise" });
  });
});
