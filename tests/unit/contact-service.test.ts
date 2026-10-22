import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { envoyerMessageContact } from "@/modules/contact/service";
import { creerTestDependancesContact } from "../doubles/TEST_dependances-contact";

const VALIDE = { nom: "  TEST_Awa  ", email: "TEST_awa@example.invalid", message: "Bonjour, ceci est un message de test.", langue: "fr" } as const;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("envoyerMessageContact", () => {
  it("envoi valide : limite puis écriture, auteur visiteur, champs rognés, langue de la route", async () => {
    const { deps, appels } = creerTestDependancesContact();
    expect(await envoyerMessageContact(deps, VALIDE)).toEqual({ ok: true });
    expect(appels.ordre).toEqual(["limite", "ecriture"]);
    expect(appels.essais).toEqual([{ cle: "contact:TEST_empreinte", fenetreSecondes: 3600, maximum: 5 }]);
    expect(appels.messages).toEqual([
      { auteur: { type: "visiteur" }, nom: "TEST_Awa", email: "TEST_awa@example.invalid", message: VALIDE.message, langue: "fr" },
    ]);
  });

  it("langue anglaise transmise", async () => {
    const { deps, appels } = creerTestDependancesContact();
    await envoyerMessageContact(deps, { ...VALIDE, langue: "en" });
    expect(appels.messages).toMatchObject([{ langue: "en" }]);
  });

  it.each([
    [{ nom: "   " }, { nom: "nom_invalide" }],
    [{ nom: "x".repeat(81) }, { nom: "nom_invalide" }],
    [{ email: "pas-un-email" }, { email: "email_invalide" }],
    [{ email: `${"a".repeat(250)}@example.invalid` }, { email: "email_invalide" }],
    [{ message: "Court" }, { message: "message_invalide" }],
    [{ message: "x".repeat(2001) }, { message: "message_invalide" }],
    [{ nom: "", email: "x", message: "" }, { nom: "nom_invalide", email: "email_invalide", message: "message_invalide" }],
  ])("champ invalide %#", async (modif, champs) => {
    const { deps, appels } = creerTestDependancesContact();
    expect(await envoyerMessageContact(deps, { ...VALIDE, ...modif })).toEqual({ ok: false, erreur: "champs", champs });
    // Rien n'est enregistré et un envoi invalide ne consomme pas la limite.
    expect(appels.ordre).toEqual([]);
  });

  it("bornes acceptées : nom 80, message 10 et 2000", async () => {
    for (const modif of [{ nom: "x".repeat(80) }, { message: "x".repeat(10) }, { message: "x".repeat(2000) }]) {
      const { deps } = creerTestDependancesContact();
      expect((await envoyerMessageContact(deps, { ...VALIDE, ...modif })).ok).toBe(true);
    }
  });

  it("limite dépassée : rien n'est enregistré, message de réessai", async () => {
    const { deps, appels } = creerTestDependancesContact({ autorise: false });
    expect(await envoyerMessageContact(deps, VALIDE)).toEqual({ ok: false, erreur: "trop_d_essais", champs: {} });
    expect(appels.ordre).toEqual(["limite"]);
  });

  it("adresse IP absente : seau commun strict (même limite, clé commune)", async () => {
    const { deps, appels } = creerTestDependancesContact({ empreinte: null });
    await envoyerMessageContact(deps, VALIDE);
    expect(appels.essais).toEqual([{ cle: "contact:commun", fenetreSecondes: 3600, maximum: 5 }]);
  });

  it("erreur de la limite : pas de succès, rien n'est enregistré (on n'ouvre pas la porte par défaut)", async () => {
    const { deps, appels } = creerTestDependancesContact({ erreurLimite: "KS_LIMITE_INVALIDE" });
    expect(await envoyerMessageContact(deps, VALIDE)).toEqual({ ok: false, erreur: "generique", champs: {} });
    expect(appels.ordre).toEqual(["limite"]);
  });

  it("échec de la base : pas de succès, erreur générique", async () => {
    const { deps } = creerTestDependancesContact({ erreurEcriture: "KS_MESSAGE_INVALIDE" });
    expect(await envoyerMessageContact(deps, VALIDE)).toEqual({ ok: false, erreur: "generique", champs: {} });
  });

  it("exception du serveur : pas de succès, la cause journalisée ne contient aucune donnée saisie", async () => {
    const { deps } = creerTestDependancesContact({ exceptionEcriture: true });
    expect(await envoyerMessageContact(deps, VALIDE)).toEqual({ ok: false, erreur: "generique", champs: {} });
    const journal = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(journal).not.toContain("TEST_Awa");
    expect(journal).not.toContain("TEST_awa@example.invalid");
    expect(journal).not.toContain(VALIDE.message);
  });
});
