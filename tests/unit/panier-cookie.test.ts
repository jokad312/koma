import { describe, expect, it } from "vitest";
import { lirePanierSigne, lireSecretPanier, signerPanier } from "@/lib/panier/cookie";

const SECRET = "TEST_secret-du-panier-de-test-0123456789";
const AUTRE = "TEST_autre-secret-du-panier-0123456789ab";
const ID = "5b0e7b0e-6c1c-4c43-9c5e-7d6c2d1b8a11";

describe("cookie signé du Panier", () => {
  it("relit l'identifiant d'un cookie qu'il a signé", () => {
    expect(lirePanierSigne(signerPanier(ID, SECRET), SECRET)).toBe(ID);
  });
  it("refuse un cookie absent, vide ou sans signature", () => {
    expect(lirePanierSigne(null, SECRET)).toBeNull();
    expect(lirePanierSigne(undefined, SECRET)).toBeNull();
    expect(lirePanierSigne("", SECRET)).toBeNull();
    expect(lirePanierSigne(ID, SECRET)).toBeNull();
    expect(lirePanierSigne(`${ID}.`, SECRET)).toBeNull();
  });
  it("refuse un identifiant modifié ou une signature d'un autre secret", () => {
    const [, signature] = signerPanier(ID, SECRET).split(".");
    expect(lirePanierSigne(`5b0e7b0e-6c1c-4c43-9c5e-7d6c2d1b8a12.${signature}`, SECRET)).toBeNull();
    expect(lirePanierSigne(signerPanier(ID, SECRET), AUTRE)).toBeNull();
  });
  it("refuse une signature valide sur un texte qui n'est pas un UUID", () => {
    expect(lirePanierSigne(signerPanier("pas-un-uuid", SECRET), SECRET)).toBeNull();
  });
  it("le cookie ne contient que l'identifiant et la signature (aucun prix ni article)", () => {
    const valeur = signerPanier(ID, SECRET);
    expect(valeur.startsWith(`${ID}.`)).toBe(true);
    expect(valeur.split(".")).toHaveLength(2);
  });
});

describe("lireSecretPanier", () => {
  it("lit le secret de l'environnement", () => {
    expect(lireSecretPanier({ PANIER_COOKIE_SECRET: SECRET })).toBe(SECRET);
  });
  it("refuse un secret absent ou trop court, sans afficher sa valeur", () => {
    expect(() => lireSecretPanier({})).toThrow(/PANIER_COOKIE_SECRET/);
    try {
      lireSecretPanier({ PANIER_COOKIE_SECRET: "TEST_valeur-brève" });
    } catch (e) {
      expect(String(e)).not.toContain("TEST_valeur-brève");
    }
    expect(() => lireSecretPanier({ PANIER_COOKIE_SECRET: "TEST_valeur-brève" })).toThrow();
  });
});
