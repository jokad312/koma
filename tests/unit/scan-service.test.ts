// Story 7.6 : service de Scan. Dépendances fausses nommées TEST_ : charge du Code QR, droit, limites de la saisie à la main, lecture prudente
// de la réponse de la base, aucun appel serveur pour un contenu étranger, aucun secret dans les journaux.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extraireJeton } from "@/modules/evenements/pass-charge";
import { codeCourtValide, normaliserCodeCourt } from "@/modules/scan/code-court";
import { debutDuJourLubumbashi } from "@/modules/scan/jour";
import { LIMITE_CODE_PAR_AUTEUR, LIMITE_CODE_PAR_IP, lireReponse, scannerPass } from "@/modules/scan/service";
import type { DependancesScan, ReponseScanBase } from "@/modules/scan/types";

const EVENEMENT = "00000000-0000-4000-8000-0000000000e1";
const COMPTE = "00000000-0000-4000-8000-0000000000c1";
const JETON = "ab".repeat(24);
const AUTEUR = { type: "compte" as const, id: COMPTE, role: "admin" };
const VALIDE: ReponseScanBase = { resultat: "valide", nom: "TEST_Alice", evenementFr: "TEST_Festival", evenementEn: "TEST_Festival EN", typePassFr: "TEST_VIP", typePassEn: null };

function faux(s: Partial<DependancesScan> = {}): DependancesScan {
  return {
    exigerAcces: vi.fn<DependancesScan["exigerAcces"]>(async () => ({ auteur: AUTEUR })),
    empreinteValeur: vi.fn((v: string) => `TEST_hash_${v.length}`),
    empreinteClient: vi.fn(async () => "TEST_empreinte_ip"),
    consommerEssai: vi.fn(async () => ({ erreur: null, autorise: true })),
    scanner: vi.fn(async () => ({ erreur: null, reponse: VALIDE })),
    ...s,
  };
}
const qr = (jeton = JETON) => ({ evenementId: EVENEMENT, langue: "fr", charge: `KOMA:PASS:${jeton}` });
const manuel = (code: string) => ({ evenementId: EVENEMENT, langue: "fr", code });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("charge du Code QR", () => {
  it("lit KOMA:PASS:<jeton>, avec espaces autour", () => {
    expect(extraireJeton(`KOMA:PASS:${JETON}`)).toBe(JETON);
    expect(extraireJeton(`  KOMA:PASS:${JETON}\n`)).toBe(JETON);
  });
  it("accepte les majuscules et les ramène en minuscules avant l'envoi", async () => {
    expect(extraireJeton(`KOMA:PASS:${JETON.toUpperCase()}`)).toBe(JETON);
    const d = faux();
    await scannerPass(d, { evenementId: EVENEMENT, langue: "fr", charge: `KOMA:PASS:${JETON.toUpperCase()}` });
    expect(d.scanner).toHaveBeenCalledWith(expect.objectContaining({ jeton: JETON }));
  });
  it("refuse tout autre contenu", () => {
    for (const charge of ["", "https://exemple.test", `PASS:${JETON}`, `KOMA:PASS:${JETON}x`, "KOMA:PASS:abc", `KOMA:PASS:${"z".repeat(48)}`, JETON]) {
      expect(extraireJeton(charge), charge).toBeNull();
    }
  });
});

describe("code court", () => {
  it("normalisé : majuscules, sans espaces ni tirets", () => {
    expect(normaliserCodeCourt(" kmnp-23 45 ")).toBe("KMNP2345");
  });
  it("8 caractères de l'alphabet sans I, O, 0, 1", () => {
    expect(codeCourtValide("KMNP2345")).toBe(true);
    for (const code of ["KMNP234", "KMNP23456", "KMNP2O45", "KMNP2I45", "KMNP2045", "KMNP2145", "kmnp2345"]) expect(codeCourtValide(code), code).toBe(false);
  });
});

describe("jour de l'Événement", () => {
  it("minuit à Goma (UTC+2)", () => {
    expect(debutDuJourLubumbashi(new Date("2027-01-10T09:30:00Z")).toISOString()).toBe("2027-01-09T22:00:00.000Z");
    expect(debutDuJourLubumbashi(new Date("2027-01-10T23:30:00Z")).toISOString()).toBe("2027-01-10T22:00:00.000Z");
  });
});

describe("scan d'un Code QR", () => {
  it("transmet le jeton et rend VALIDE dans la langue demandée", async () => {
    const d = faux();
    expect(await scannerPass(d, qr())).toEqual({ ok: true, resultat: "valide", nom: "TEST_Alice", evenement: "TEST_Festival", typePass: "TEST_VIP" });
    expect(d.scanner).toHaveBeenCalledWith({ auteur: AUTEUR, evenementId: EVENEMENT, jeton: JETON, code: null, appareil: null });
    expect(await scannerPass(d, { ...qr(), langue: "en" })).toMatchObject({ evenement: "TEST_Festival EN", typePass: "TEST_VIP" });
  });
  it("le Code QR n'est pas limité par consommer_essai", async () => {
    const d = faux();
    await scannerPass(d, qr());
    expect(d.consommerEssai).not.toHaveBeenCalled();
  });
  it("un contenu étranger est refusé sans appel à la base", async () => {
    const d = faux();
    expect(await scannerPass(d, { evenementId: EVENEMENT, langue: "fr", charge: "https://exemple.test/x" })).toEqual({ ok: true, resultat: "refuse", raison: "qr_invalide", scanneLe: null });
    expect(d.scanner).not.toHaveBeenCalled();
  });
  it("rend le refus et l'heure du premier scan", async () => {
    const d = faux({ scanner: vi.fn(async () => ({ erreur: null, reponse: { resultat: "refuse" as const, raison: "deja_scanne" as const, scanneLe: "2027-01-10T08:00:00Z" } })) });
    expect(await scannerPass(d, qr())).toEqual({ ok: true, resultat: "refuse", raison: "deja_scanne", scanneLe: "2027-01-10T08:00:00Z" });
  });
  it("refuse une saisie ambiguë, un Événement invalide, une charge trop longue", async () => {
    const d = faux();
    expect(await scannerPass(d, { evenementId: EVENEMENT, langue: "fr" })).toEqual({ ok: false, erreur: "saisie_invalide" });
    expect(await scannerPass(d, { evenementId: EVENEMENT, langue: "fr", charge: "a", code: "b" })).toEqual({ ok: false, erreur: "saisie_invalide" });
    expect(await scannerPass(d, { ...qr(), evenementId: "pas-un-uuid" })).toEqual({ ok: false, erreur: "evenement_invalide" });
    expect(await scannerPass(d, { evenementId: EVENEMENT, langue: "fr", charge: "x".repeat(201) })).toEqual({ ok: false, erreur: "saisie_invalide" });
    expect(d.exigerAcces).not.toHaveBeenCalled();
  });
});

describe("droit de scanner", () => {
  it("le droit est demandé pour l'Événement choisi (accès bénévole par Événement, story 7.7)", async () => {
    const d = faux();
    await scannerPass(d, qr());
    expect(d.exigerAcces).toHaveBeenCalledWith(EVENEMENT);
  });
  it("un bénévole sans accès valable pour cet Événement : refus, aucun appel à la base ni aux limites", async () => {
    const d = faux({ exigerAcces: vi.fn(async () => { throw new Error("KS_DROIT_REFUSE"); }) });
    expect(await scannerPass(d, manuel("KMNP2345"))).toEqual({ ok: false, erreur: "non_autorise" });
    expect(d.consommerEssai).not.toHaveBeenCalled();
    expect(d.scanner).not.toHaveBeenCalled();
  });
  it("visiteur et Compte sans droit : aucun appel à la base", async () => {
    for (const [code, erreur] of [["KS_NON_CONNECTE", "non_connecte"], ["KS_DROIT_REFUSE", "non_autorise"]] as const) {
      const d = faux({ exigerAcces: vi.fn(async () => { throw new Error(code); }) });
      expect(await scannerPass(d, qr())).toEqual({ ok: false, erreur });
      expect(d.scanner).not.toHaveBeenCalled();
    }
  });
  it("vérification impossible : échec générique, jamais un VALIDE", async () => {
    const d = faux({ exigerAcces: vi.fn(async () => { throw new Error("KS_VERIFICATION_IMPOSSIBLE"); }) });
    expect(await scannerPass(d, qr())).toEqual({ ok: false, erreur: "generique" });
  });
  it("la base qui refuse le droit est relayée", async () => {
    const d = faux({ scanner: vi.fn(async () => ({ erreur: "KS_DROIT_REFUSE", reponse: null })) });
    expect(await scannerPass(d, qr())).toEqual({ ok: false, erreur: "non_autorise" });
  });
});

describe("saisie à la main", () => {
  it("normalise le code, limite par auteur puis par adresse IP hachés, puis scanne", async () => {
    const d = faux();
    expect((await scannerPass(d, manuel(" kmnp-2345 "))).ok).toBe(true);
    expect(d.scanner).toHaveBeenCalledWith({ auteur: AUTEUR, evenementId: EVENEMENT, jeton: null, code: "KMNP2345", appareil: null });
    const appels = vi.mocked(d.consommerEssai).mock.calls.map(([a]) => a);
    expect(appels).toHaveLength(2);
    expect(appels[0]).toMatchObject({ cle: expect.stringMatching(/^scan:code:auteur:TEST_hash_/), maximum: LIMITE_CODE_PAR_AUTEUR });
    expect(appels[1]).toMatchObject({ cle: "scan:code:ip:TEST_empreinte_ip", maximum: LIMITE_CODE_PAR_IP });
    // Ni l'identifiant du Compte ni l'adresse IP en clair dans les clés.
    for (const a of appels) expect(a.cle).not.toContain(COMPTE);
  });
  it("limite dépassée (auteur ou IP) : trop_d_essais, la base n'est pas appelée", async () => {
    for (const refuse of [0, 1]) {
      let n = 0;
      const d = faux({ consommerEssai: vi.fn(async () => ({ erreur: null, autorise: n++ !== refuse })) });
      expect(await scannerPass(d, manuel("KMNP2345"))).toEqual({ ok: false, erreur: "trop_d_essais" });
      expect(d.scanner).not.toHaveBeenCalled();
    }
  });
  it("panne du compteur : échec générique (jamais de scan sans limite)", async () => {
    const d = faux({ consommerEssai: vi.fn(async () => ({ erreur: "KS_LIMITE_INVALIDE", autorise: false })) });
    expect(await scannerPass(d, manuel("KMNP2345"))).toEqual({ ok: false, erreur: "generique" });
    expect(d.scanner).not.toHaveBeenCalled();
  });
  it("code mal formé : « inconnu », comme un code absent, sans appel à la base mais en comptant l'essai", async () => {
    const d = faux();
    expect(await scannerPass(d, manuel("AB01"))).toEqual({ ok: true, resultat: "refuse", raison: "inconnu", scanneLe: null });
    expect(d.consommerEssai).toHaveBeenCalledTimes(2);
    expect(d.scanner).not.toHaveBeenCalled();
  });
});

describe("réponse de la base et journaux", () => {
  it("une réponse de forme inattendue n'est jamais prise pour un VALIDE", async () => {
    for (const reponse of [null, lireReponse({ resultat: "valide" }), lireReponse("valide"), lireReponse({ resultat: "refuse", raison: "autre" }), lireReponse([])]) {
      const d = faux({ scanner: vi.fn(async () => ({ erreur: null, reponse })) });
      expect(await scannerPass(d, qr())).toEqual({ ok: false, erreur: "generique" });
    }
  });
  it("lireReponse relit la forme de scanner_pass", () => {
    expect(lireReponse({ resultat: "valide", nom: "A", evenement_fr: "E", evenement_en: null, type_pass_fr: "T", type_pass_en: "U" })).toEqual({
      resultat: "valide", nom: "A", evenementFr: "E", evenementEn: null, typePassFr: "T", typePassEn: "U",
    });
    expect(lireReponse({ resultat: "refuse", raison: "deja_scanne", scanne_le: "2027-01-10T08:00:00Z" })).toEqual({ resultat: "refuse", raison: "deja_scanne", scanneLe: "2027-01-10T08:00:00Z" });
    expect(lireReponse({ resultat: "refuse", raison: "annule", scanne_le: "x" })).toEqual({ resultat: "refuse", raison: "annule", scanneLe: null });
  });
  it("les journaux ne contiennent ni le jeton, ni le code court, ni le nom", async () => {
    const espion = vi.mocked(console.error);
    const d = faux({ scanner: vi.fn(async () => ({ erreur: `KS_AUTRE ${JETON} KMNP2345 TEST_Alice`, reponse: null })) });
    await scannerPass(d, qr());
    await scannerPass({ ...d, scanner: vi.fn(async () => { throw new Error(`boom ${JETON} KMNP2345`); }) }, manuel("KMNP2345"));
    const texte = espion.mock.calls.map((a) => a.join(" ")).join("\n");
    expect(texte).toContain("[scan]");
    for (const secret of [JETON, "KMNP2345", "TEST_Alice"]) expect(texte).not.toContain(secret);
  });
});
