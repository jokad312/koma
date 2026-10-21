import { describe, expect, it } from "vitest";
import { cheminRetourValide } from "@/lib/auth/retour";

describe("chemin de retour après la connexion", () => {
  const valides = ["/fr", "/en", "/fr/cosplays", "/en/cosplays/x?taille=m", "/fr/blog#haut", "/en?a=1"];
  for (const chemin of valides) {
    it(`accepte ${chemin}`, () => expect(cheminRetourValide(chemin, "fr")).toBe(chemin));
  }

  const hostiles = [
    "https://x.fr",
    "http://x.fr/fr",
    "//x.fr",
    "/\\x.fr",
    "/fr\\x",
    "/fr//x.fr",
    "/fr/%5Cx.fr",
    "/fr/%2F%2Fx.fr",
    "/fr/connexion",
    "/en/connexion?retour=/fr",
    "/fr/Connexion",
    "/frx",
    "/de/cosplays",
    "/",
    "/fr/\u0000",
    "/fr/\n",
    "javascript:alert(1)",
    "",
    "fr/cosplays",
    "/fr/%E0%A4%A",
  ];
  for (const chemin of hostiles) {
    it(`refuse ${JSON.stringify(chemin)} : accueil de la langue`, () => {
      expect(cheminRetourValide(chemin, "en")).toBe("/en");
    });
  }

  it("refuse ce qui n'est pas du texte", () => {
    expect(cheminRetourValide(undefined, "fr")).toBe("/fr");
    expect(cheminRetourValide(["/fr/x"], "fr")).toBe("/fr");
    expect(cheminRetourValide(42, "en")).toBe("/en");
  });

  it("refuse un chemin trop long", () => {
    expect(cheminRetourValide(`/fr/${"a".repeat(600)}`, "fr")).toBe("/fr");
  });
});
