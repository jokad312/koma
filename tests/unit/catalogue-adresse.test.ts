import { describe, expect, it } from "vitest";
import {
  adresseAvecRequete,
  aFiltreOuTri,
  analyserRequete,
  compterFiltres,
  decoderCurseur,
  encoderCurseur,
  requeteAvecCurseur,
  serialiserRequete,
} from "@/modules/catalogue/adresse";

const ID = "00000000-0000-4000-8000-000000000001";
const DATE = "2026-10-26 10:00:00.123456+00";

describe("analyserRequete", () => {
  it("adresse vide : valeurs par défaut", () => {
    expect(analyserRequete({})).toEqual({ univers: null, prixBas: null, prixHaut: null, dispo: null, tri: "nouveautes", curseur: null });
    expect(aFiltreOuTri(analyserRequete({}))).toBe(false);
  });

  it("lit univers, prix, disponibilité et tri valides", () => {
    const p = analyserRequete({ univers: ID, prix: "1500-3000", dispo: "en_stock", tri: "prix_desc" });
    expect(p).toMatchObject({ univers: ID, prixBas: 1500, prixHaut: 3000, dispo: "en_stock", tri: "prix_desc" });
    expect(compterFiltres(p)).toBe(3);
    expect(aFiltreOuTri(p)).toBe(true);
  });

  it("tranche ouverte : « 5000- » n'a pas de borne haute", () => {
    expect(analyserRequete({ prix: "5000-" })).toMatchObject({ prixBas: 5000, prixHaut: null });
  });

  it("accepte aussi un URLSearchParams et prend la première valeur d'un paramètre répété", () => {
    expect(analyserRequete(new URLSearchParams("tri=prix_asc&dispo=sur_commande")).tri).toBe("prix_asc");
    expect(analyserRequete({ tri: ["prix_asc", "prix_desc"] }).tri).toBe("prix_asc");
  });

  it.each([
    ["univers", "pas-un-uuid"],
    ["univers", ""],
    ["prix", "abc"],
    ["prix", "3000-1500"],
    ["prix", "1500-1500"],
    ["prix", "-5"],
    ["prix", "99999999999-"],
    ["prix", "1.5-3"],
    ["dispo", "complet"],
    ["dispo", "EN_STOCK"],
    ["tri", "hasard"],
    ["curseur", "n'importe quoi"],
    ["curseur", "!!!"],
  ])("paramètre mal formé ignoré : %s=%s", (cle, valeur) => {
    expect(analyserRequete({ [cle]: valeur })).toEqual(analyserRequete({}));
  });

  it("paramètres inconnus ignorés, sans exception", () => {
    expect(analyserRequete({ foo: "bar", __proto__: "x" } as never)).toEqual(analyserRequete({}));
  });
});

describe("curseur", () => {
  it("aller-retour en nouveautés (date) et en tri par prix (prix)", () => {
    const n = encoderCurseur("nouveautes", { date: DATE, prix: 1500, id: ID, n: 24 });
    expect(decoderCurseur(n, "nouveautes")).toEqual({ date: DATE, prix: null, id: ID, n: 24 });
    const a = encoderCurseur("prix_asc", { date: DATE, prix: 1500, id: ID, n: 24 });
    expect(decoderCurseur(a, "prix_asc")).toEqual({ date: null, prix: 1500, id: ID, n: 24 });
    expect(decoderCurseur(a, "prix_asc")).toEqual(decoderCurseur(encoderCurseur("prix_asc", { date: null, prix: 1500, id: ID, n: 24 }), "prix_asc"));
  });

  it("opaque : ni l'identifiant ni la date n'apparaissent en clair", () => {
    const c = encoderCurseur("nouveautes", { date: DATE, prix: null, id: ID, n: 24 });
    expect(c).not.toContain(ID);
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("un curseur d'un autre tri est refusé (retour à la première page)", () => {
    const c = encoderCurseur("prix_asc", { date: null, prix: 1500, id: ID, n: 24 });
    expect(decoderCurseur(c, "nouveautes")).toBeNull();
    expect(decoderCurseur(c, "prix_desc")).toBeNull();
  });

  it("curseur périmé ou falsifié : refusé sans exception", () => {
    const faux = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64url");
    for (const texte of [
      null,
      "",
      "a".repeat(300),
      Buffer.from("pas du json").toString("base64url"),
      faux(["nouveautes", "pas une date", ID, 12]),
      faux(["nouveautes", DATE, "pas-un-uuid", 12]),
      faux(["nouveautes", DATE, ID]),
      faux(["nouveautes", DATE, ID, 0]),
      faux(["nouveautes", DATE, ID, 13]),
      faux(["nouveautes", DATE, ID, 252]),
      faux(["nouveautes", DATE, ID, -12]),
      faux(["nouveautes", DATE, ID, "24"]),
      faux(["nouveautes", DATE, ID, 24.5]),
      faux({ tri: "nouveautes" }),
      faux(["prix_asc", "1500", ID, 12]),
      faux(["prix_asc", -1, ID, 12]),
      faux(["prix_asc", 1.5, ID, 12]),
      faux(["prix_asc", 99999999999, ID, 12]),
    ]) {
      expect(decoderCurseur(texte, "prix_asc")).toBeNull();
      expect(decoderCurseur(texte, "nouveautes")).toBeNull();
    }
  });

  it("le nombre n de produits déjà affichés est plafonné à 240 et reste un multiple de 12", () => {
    const e = (n: number) => encoderCurseur("prix_asc", { date: null, prix: 1500, id: ID, n });
    expect(decoderCurseur(e(12), "prix_asc")?.n).toBe(12);
    expect(decoderCurseur(e(240), "prix_asc")?.n).toBe(240);
    expect(decoderCurseur(e(252), "prix_asc")).toBeNull();
    expect(decoderCurseur(e(0), "prix_asc")).toBeNull();
    expect(decoderCurseur(e(18), "prix_asc")).toBeNull();
  });

  it("lu depuis l'adresse", () => {
    const c = encoderCurseur("prix_desc", { date: null, prix: 2500, id: ID, n: 36 });
    expect(analyserRequete({ tri: "prix_desc", curseur: c }).curseur).toEqual({ date: null, prix: 2500, id: ID, n: 36 });
    // Même curseur mais tri par défaut dans l'adresse : première page.
    expect(analyserRequete({ curseur: c }).curseur).toBeNull();
  });
});

describe("serialiserRequete", () => {
  it("n'écrit que les valeurs non par défaut, dans un ordre stable", () => {
    expect(serialiserRequete({ univers: null, prixBas: null, prixHaut: null, dispo: null, tri: "nouveautes" })).toBe("");
    expect(serialiserRequete({ univers: ID, prixBas: 1500, prixHaut: null, dispo: "sur_commande", tri: "prix_asc" }, "CUR")).toBe(
      `univers=${ID}&prix=1500-&dispo=sur_commande&tri=prix_asc&curseur=CUR`,
    );
  });

  it("relit ce qu'elle a écrit", () => {
    const base = { univers: ID, prixBas: 1500, prixHaut: 3000, dispo: "en_stock" as const, tri: "prix_desc" as const };
    expect(analyserRequete(new URLSearchParams(serialiserRequete(base)))).toEqual({ ...base, curseur: null });
  });

  it("adresse et curseur", () => {
    expect(adresseAvecRequete("/cosplays", "")).toBe("/cosplays");
    expect(adresseAvecRequete("/cosplays", "tri=prix_asc")).toBe("/cosplays?tri=prix_asc");
    expect(requeteAvecCurseur("tri=prix_asc", "CUR")).toBe("tri=prix_asc&curseur=CUR");
    expect(requeteAvecCurseur("", "CUR")).toBe("curseur=CUR");
  });
});
