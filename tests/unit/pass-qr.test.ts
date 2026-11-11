// Story 7.5 : Code QR d'un Pass. La charge contient le jeton secret (jamais l'identifiant), la matrice est dessinée avec une zone de silence de 4 modules,
// l'image jointe à l'email est un GIF. Aucun paiement ni Pass réel : jetons de test clairement nommés.
import { describe, expect, it } from "vitest";
import { calculerCodeQr, chargeQr, codeQrEnGif, extraireJeton, jetonValide, PREFIXE_CHARGE_QR, ZONE_SILENCE_MODULES } from "@/modules/evenements/pass-qr";

const JETON_TEST_A = "0123456789abcdef0123456789abcdef0123456789abcdef";
const JETON_TEST_B = "fedcba9876543210fedcba9876543210fedcba9876543210";

describe("charge du Code QR", () => {
  it("encode le jeton derrière un préfixe, et le relit", () => {
    const charge = chargeQr(JETON_TEST_A);
    expect(charge).toBe(`${PREFIXE_CHARGE_QR}${JETON_TEST_A}`);
    expect(extraireJeton(charge)).toBe(JETON_TEST_A);
    expect(extraireJeton(`  ${charge}\n`)).toBe(JETON_TEST_A);
  });

  it("n'est pas une adresse : un appareil photo qui la lit n'ouvre rien", () => {
    expect(chargeQr(JETON_TEST_A)).not.toMatch(/^[a-z]+:\/\//i);
  });

  it("refuse un jeton mal formé (trop court, majuscules, identifiant de Pass, texte libre)", () => {
    for (const mauvais of ["", "abc", JETON_TEST_A.toUpperCase(), "00000000-0000-4000-8000-0000000000a1", `${JETON_TEST_A}0`, "g".repeat(48)]) {
      expect(jetonValide(mauvais)).toBe(false);
      expect(() => chargeQr(mauvais)).toThrow();
    }
  });

  it("ne relit rien d'une charge qui n'est pas un Pass KOMA bien formé", () => {
    for (const mauvaise of ["", JETON_TEST_A, "https://example.invalid/" + JETON_TEST_A, `${PREFIXE_CHARGE_QR}abc`, `AUTRE:PASS:${JETON_TEST_A}`, `${PREFIXE_CHARGE_QR}${JETON_TEST_A}x`]) {
      expect(extraireJeton(mauvaise)).toBeNull();
    }
  });
});

describe("matrice du Code QR", () => {
  it("compte la zone de silence de 4 modules dans la taille et ne dessine rien dedans", () => {
    const qr = calculerCodeQr(chargeQr(JETON_TEST_A));
    expect(ZONE_SILENCE_MODULES).toBe(4);
    // Version 4 (33 modules) pour 58 octets au niveau M, plus 4 modules de chaque côté.
    expect(qr.taille).toBe(33 + 8);
    const coordonnees = [...qr.chemin.matchAll(/M(\d+),(\d+)h(\d+)v1h-\d+z/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), l: Number(m[3]) }));
    expect(coordonnees.length).toBeGreaterThan(50);
    for (const c of coordonnees) {
      expect(c.x).toBeGreaterThanOrEqual(ZONE_SILENCE_MODULES);
      expect(c.y).toBeGreaterThanOrEqual(ZONE_SILENCE_MODULES);
      expect(c.y).toBeLessThan(qr.taille - ZONE_SILENCE_MODULES);
      expect(c.x + c.l).toBeLessThanOrEqual(qr.taille - ZONE_SILENCE_MODULES);
    }
  });

  it("dessine les trois repères de position (coins du Code QR)", () => {
    const qr = calculerCodeQr(chargeQr(JETON_TEST_A));
    // Première ligne du repère en haut à gauche : 7 modules noirs à partir de la zone de silence.
    expect(qr.chemin).toContain(`M${ZONE_SILENCE_MODULES},${ZONE_SILENCE_MODULES}h7v1h-7z`);
  });

  it("est stable pour un même jeton et différent pour deux jetons", () => {
    expect(calculerCodeQr(chargeQr(JETON_TEST_A)).chemin).toBe(calculerCodeQr(chargeQr(JETON_TEST_A)).chemin);
    expect(calculerCodeQr(chargeQr(JETON_TEST_A)).chemin).not.toBe(calculerCodeQr(chargeQr(JETON_TEST_B)).chemin);
  });
});

describe("image du Code QR pour l'email", () => {
  it("est un GIF d'environ 250 pixels, zone de silence comprise", () => {
    const gif = codeQrEnGif(chargeQr(JETON_TEST_A));
    expect(gif.subarray(0, 3).toString("ascii")).toBe("GIF");
    // Largeur et hauteur en petit-boutiste aux octets 6 à 9 : (33 + 8) modules de 6 pixels.
    expect(gif.readUInt16LE(6)).toBe(41 * 6);
    expect(gif.readUInt16LE(8)).toBe(41 * 6);
  });
});
