import { beforeEach, describe, expect, it, vi } from "vitest";
import { creerTestDependancesContact } from "../doubles/TEST_dependances-contact";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({ courant: null as unknown }));
vi.mock("@/modules/contact/dependances", () => ({
  dependances: () => {
    if (faux.courant instanceof Error) throw faux.courant;
    return faux.courant;
  },
}));

import { envoyerMessageContact } from "@/modules/contact/actions";

function formulaire(valeurs: Record<string, string>) {
  const f = new FormData();
  for (const [cle, valeur] of Object.entries(valeurs)) f.set(cle, valeur);
  return f;
}

const SAISIE = { nom: "TEST_Awa", email: "TEST_awa@example.invalid", message: "Bonjour, ceci est un message de test.", langue: "en" };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Server Action envoyerMessageContact", () => {
  it("succès : rendu seulement après la réponse réelle, langue de la route transmise", async () => {
    const { deps, appels } = creerTestDependancesContact();
    faux.courant = deps;
    expect(await envoyerMessageContact(null, formulaire(SAISIE))).toEqual({ statut: "succes" });
    expect(appels.messages).toMatchObject([{ langue: "en", auteur: { type: "visiteur" } }]);
  });

  it("message multi-ligne de 2000 caractères en CRLF : normalisé en LF, accepté", async () => {
    const { deps, appels } = creerTestDependancesContact();
    faux.courant = deps;
    const lf = ("x".repeat(99) + "\n").repeat(20);
    expect(lf).toHaveLength(2000);
    const etat = await envoyerMessageContact(null, formulaire({ ...SAISIE, message: lf.replace(/\n/g, "\r\n") }));
    expect(etat).toEqual({ statut: "succes" });
    expect(appels.messages).toMatchObject([{ message: lf.trim() }]);
  });

  it("langue inconnue ou absente : français", async () => {
    const { deps, appels } = creerTestDependancesContact();
    faux.courant = deps;
    await envoyerMessageContact(null, formulaire({ ...SAISIE, langue: "xx" }));
    await envoyerMessageContact(null, formulaire({ nom: SAISIE.nom, email: SAISIE.email, message: SAISIE.message }));
    expect(appels.messages).toMatchObject([{ langue: "fr" }, { langue: "fr" }]);
  });

  it("champ invalide : erreur sous le champ, saisie rendue, rien d'enregistré", async () => {
    const { deps, appels } = creerTestDependancesContact();
    faux.courant = deps;
    const etat = await envoyerMessageContact(null, formulaire({ ...SAISIE, email: "faux" }));
    expect(etat).toEqual({
      statut: "erreur",
      erreur: "champs",
      champs: { email: "email_invalide" },
      valeurs: { nom: SAISIE.nom, email: "faux", message: SAISIE.message },
    });
    expect(appels.messages).toEqual([]);
  });

  it("limite atteinte : saisie gardée, message de réessai", async () => {
    faux.courant = creerTestDependancesContact({ refuserPrefixe: "contact:email:" }).deps;
    expect(await envoyerMessageContact(null, formulaire(SAISIE))).toMatchObject({
      statut: "erreur",
      erreur: "trop_d_essais",
      valeurs: { nom: SAISIE.nom, email: SAISIE.email, message: SAISIE.message },
    });
  });

  it("échec de la base : pas de succès, saisie gardée", async () => {
    faux.courant = creerTestDependancesContact({ erreurEcriture: "boum" }).deps;
    expect(await envoyerMessageContact(null, formulaire(SAISIE))).toMatchObject({ statut: "erreur", erreur: "generique", valeurs: { message: SAISIE.message } });
  });

  it("exception du câblage : erreur générique, saisie gardée", async () => {
    faux.courant = new Error("boum");
    expect(await envoyerMessageContact(null, formulaire(SAISIE))).toMatchObject({ statut: "erreur", erreur: "generique", valeurs: { nom: SAISIE.nom } });
  });
});
