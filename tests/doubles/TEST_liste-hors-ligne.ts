import { createHash, createHmac } from "node:crypto";
import type { ListeTelechargee } from "@/modules/scan/hors-ligne-types";

// Double de test (données TEST_) : une liste hors ligne telle que la base la rend, calculée avec node:crypto (SHA-256 du jeton, HMAC-SHA-256 du code court).
// Les valeurs ont été recoupées avec pgcrypto sur koma-dev : digest(repeat('ab',24),'sha256') et hmac('KMNP2345', clé 0x01 x 32).
export const TEST_EVENEMENT = "00000000-0000-4000-8000-0000000000e1";
export const TEST_APPAREIL = "0123456789abcdef0123456789abcdef";
export const TEST_CLE_HEX = "01".repeat(32);

export const TEST_PASS = [
  { jeton: "ab".repeat(24), code: "KMNP2345", nom: "TEST_Alice", type: 0 },
  { jeton: "cd".repeat(24), code: "AAAAAAA2", nom: "TEST_Bob", type: 1 },
  { jeton: "ef".repeat(24), code: "BBBBBBB3", nom: "TEST_Cleo", type: 0 },
] as const;

export const sha256 = (valeur: string) => createHash("sha256").update(valeur).digest("hex");
export const hmac = (code: string, cleHex = TEST_CLE_HEX) => createHmac("sha256", Buffer.from(cleHex, "hex")).update(code).digest("hex");

export function listeDeTest(surcharge: Partial<ListeTelechargee> = {}): ListeTelechargee {
  return {
    verrouId: "00000000-0000-4000-8000-0000000000f1",
    prisLe: "2027-01-09T08:00:00.000Z",
    expireLe: "2027-01-10T22:00:00.000Z",
    genereLe: "2027-01-09T08:00:01.000Z",
    evenementFr: "TEST_Festival",
    evenementEn: "TEST_Festival EN",
    cleCodeCourt: TEST_CLE_HEX,
    types: [
      { fr: "TEST_VIP", en: "TEST_VIP EN" },
      { fr: "TEST_Simple", en: null },
    ],
    pass: TEST_PASS.map((p) => ({ j: sha256(p.jeton), c: hmac(p.code), n: p.nom, t: p.type })),
    ...surcharge,
  };
}
