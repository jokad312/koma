// Code court de secours d'un Pass (story 7.5) : 8 caractères parmi 32 (sans I, O, 0, 1). Même règle que scanner_pass.
const MOTIF_CODE_COURT = /^[A-HJ-NP-Z2-9]{8}$/;

// Majuscules, sans espaces ni tirets (ce que l'on tape à la main ou lit sur un papier).
export function normaliserCodeCourt(saisie: string): string {
  return saisie.replace(/[\s-]/g, "").toUpperCase();
}

export function codeCourtValide(code: string): boolean {
  return MOTIF_CODE_COURT.test(code);
}
