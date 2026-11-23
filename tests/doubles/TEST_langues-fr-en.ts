// Double de src/i18n/langues-actives.ts (tests uniquement) : le français ET l'anglais actifs, comme avant le 2026-11-22.
// Sert aux tests qui vérifient que l'anglais, désactivé mais conservé, fonctionne toujours le jour où il est réactivé
// (adresses /en, hreflang, plan du site, emails en anglais). Usage : vi.mock("@/i18n/langues-actives", () => import("../doubles/TEST_langues-fr-en")).
export const LANGUES_ACTIVES = ["fr", "en"] as const;

export type LangueActive = (typeof LANGUES_ACTIVES)[number];

export function estLangueActive(langue: string | null | undefined): langue is LangueActive {
  return langue === "fr" || langue === "en";
}

export const PLUSIEURS_LANGUES = true;

export function langueServie(langue: unknown): LangueActive {
  return langue === "en" ? "en" : "fr";
}
