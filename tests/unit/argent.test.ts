import { describe, expect, it } from "vitest";
import { analyserForfaitUsd, analyserMontantUsd, analyserPrixUsd, formaterUsd, prixPourSaisie } from "@/lib/argent";

describe("analyserPrixUsd", () => {
  it.each([
    ["49,90", 4990],
    ["49.90", 4990],
    ["49,9", 4990],
    ["49", 4900],
    ["0,5", 50],
    ["0.01", 1],
    [" 12 ", 1200],
    ["10000", 1_000_000],
  ])("« %s » vaut %i centimes", (texte, cents) => {
    expect(analyserPrixUsd(texte)).toEqual({ ok: true, cents });
  });

  it.each(["0", "0,00", "-3", "12,345", "abc", "1 000", "12,", ",5", "10000,01", "10001", "1e3", "12.3.4"])("« %s » est invalide", (texte) => {
    expect(analyserPrixUsd(texte)).toEqual({ ok: false, raison: "invalide" });
  });

  it("vide : prix non fixé, ce n'est pas une erreur", () => {
    expect(analyserPrixUsd("")).toEqual({ ok: false, raison: "vide" });
    expect(analyserPrixUsd("   ")).toEqual({ ok: false, raison: "vide" });
  });
});

describe("formaterUsd", () => {
  it("toujours en USD, selon la langue", () => {
    expect(formaterUsd(4990, "en")).toBe("$49.90");
    // Espace insécable avant le symbole en français ; la devise reste le dollar américain.
    expect(formaterUsd(4990, "fr").replace(/\s/g, " ")).toBe("49,90 $US");
  });
});

describe("prixPourSaisie", () => {
  it("recompose la saisie d'un prix enregistré", () => {
    expect(prixPourSaisie(4990)).toBe("49.90");
    expect(prixPourSaisie(4900)).toBe("49");
    expect(prixPourSaisie(5)).toBe("0.05");
    expect(prixPourSaisie(null)).toBe("");
  });

  it("aller-retour avec analyserPrixUsd", () => {
    for (const cents of [1, 50, 4990, 4900, 1_000_000]) expect(analyserPrixUsd(prixPourSaisie(cents))).toEqual({ ok: true, cents });
  });
});

describe("analyserForfaitUsd", () => {
  it.each([
    ["5", 500],
    ["5,50", 550],
    ["0", 0],
    ["0,00", 0],
    ["1000", 100_000],
  ])("« %s » vaut %i centimes", (texte, cents) => {
    expect(analyserForfaitUsd(texte)).toEqual({ ok: true, cents });
  });

  it.each(["-1", "abc", "5,555", "1001", "1000,01", "1 000"])("« %s » est invalide", (texte) => {
    expect(analyserForfaitUsd(texte)).toEqual({ ok: false, raison: "invalide" });
  });

  it("vide : raison « vide »", () => {
    expect(analyserForfaitUsd("  ")).toEqual({ ok: false, raison: "vide" });
  });
});

describe("analyserMontantUsd", () => {
  it("accepte zéro et applique le plafond donné", () => {
    expect(analyserMontantUsd("0", 1000)).toEqual({ ok: true, cents: 0 });
    expect(analyserMontantUsd("10", 1000)).toEqual({ ok: true, cents: 1000 });
    expect(analyserMontantUsd("10,01", 1000)).toEqual({ ok: false, raison: "invalide" });
  });
});
