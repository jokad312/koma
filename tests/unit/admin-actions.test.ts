import { beforeEach, describe, expect, it, vi } from "vitest";
import { creerTestDependancesAdmin } from "../doubles/TEST_dependances-admin";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({ courant: null as unknown }));
vi.mock("@/modules/admin/dependances", () => ({
  dependances: () => {
    if (faux.courant instanceof Error) throw faux.courant;
    return faux.courant;
  },
}));

import { enregistrerReglage } from "@/modules/admin/actions";

function formulaire(valeurs: Record<string, string>) {
  const f = new FormData();
  for (const [cle, valeur] of Object.entries(valeurs)) f.set(cle, valeur);
  return f;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Server Action enregistrerReglage", () => {
  it("succès : rendu seulement après la réponse, avec la valeur normalisée", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    faux.courant = deps;
    const etat = await enregistrerReglage(null, formulaire({ cle: "numero_whatsapp", valeur: "+243 970 000 000" }));
    expect(etat).toEqual({ statut: "succes", cle: "numero_whatsapp", valeur: "+243970000000" });
    expect(appels.ordre).toEqual(["droit", "ecriture", "invalidation"]);
  });

  it("numéro effacé : succès avec une valeur vide", async () => {
    faux.courant = creerTestDependancesAdmin().deps;
    expect(await enregistrerReglage(null, formulaire({ cle: "numero_whatsapp", valeur: "" }))).toEqual({ statut: "succes", cle: "numero_whatsapp", valeur: "" });
  });

  it("échec : aucune réussite, la saisie revient", async () => {
    const { deps, appels } = creerTestDependancesAdmin({ erreurEcriture: "boum" });
    faux.courant = deps;
    const etat = await enregistrerReglage(null, formulaire({ cle: "nom_site", valeur: "Mon nom" }));
    expect(etat).toEqual({ statut: "erreur", cle: "nom_site", erreur: "generique", valeur: "Mon nom" });
    expect(appels.ordre).not.toContain("invalidation");
  });

  it("saisie invalide : erreur de champ, saisie conservée, rien d'écrit", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    faux.courant = deps;
    expect(await enregistrerReglage(null, formulaire({ cle: "numero_whatsapp", valeur: "abc" }))).toEqual({ statut: "erreur", cle: "numero_whatsapp", erreur: "numero_invalide", valeur: "abc" });
    expect(appels.reglages).toEqual([]);
  });

  it("clé inconnue ou absente : refusée sans toucher au serveur", async () => {
    const { deps } = creerTestDependancesAdmin();
    faux.courant = deps;
    expect(await enregistrerReglage(null, formulaire({ cle: "pirate", valeur: "x" }))).toMatchObject({ statut: "erreur", erreur: "generique" });
    expect(await enregistrerReglage(null, formulaire({ valeur: "x" }))).toMatchObject({ statut: "erreur", erreur: "generique" });
    expect(deps.exigerDroit).not.toHaveBeenCalled();
  });

  it("exception du câblage ou du service : erreur générique, la saisie revient", async () => {
    faux.courant = new Error("boum");
    const etat = await enregistrerReglage(null, formulaire({ cle: "nom_site", valeur: "Mon nom" }));
    expect(etat).toEqual({ statut: "erreur", cle: "nom_site", erreur: "generique", valeur: "Mon nom" });
  });

  it("droit perdu : non autorisé", async () => {
    faux.courant = creerTestDependancesAdmin({ droit: "KS_DROIT_REFUSE" }).deps;
    expect(await enregistrerReglage(null, formulaire({ cle: "nom_site", valeur: "x" }))).toMatchObject({ statut: "erreur", erreur: "non_autorise" });
  });
});
