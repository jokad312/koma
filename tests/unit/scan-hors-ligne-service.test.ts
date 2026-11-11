// Story 7.8 : service serveur du Scan hors ligne. Dépendances fausses nommées TEST_ : droits (Admin, bénévole, session, Admin seul pour forcer), codes d'erreur de
// la base traduits, lecture prudente de la liste, lots bornés, aucun secret dans les journaux, verrou refusé aux autres appareils côté scan en ligne.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { forcerLiberation, libererVerrou, lireEtatVerrou, lireListe, prendreEtTelecharger, synchroniserScans, type DependancesHorsLigne } from "@/modules/scan/hors-ligne-service";
import { scannerPass } from "@/modules/scan/service";
import type { DependancesScan } from "@/modules/scan/types";
import { listeDeTest, TEST_APPAREIL, TEST_EVENEMENT, TEST_PASS } from "../doubles/TEST_liste-hors-ligne";

const COMPTE = "00000000-0000-4000-8000-0000000000c1";
const AUTEUR = { type: "compte" as const, id: COMPTE, role: null };
const ENTREE = { evenementId: TEST_EVENEMENT, appareil: TEST_APPAREIL };

// Réponse de telecharger_liste_hors_ligne, avec les noms de champs de la base.
const REPONSE_LISTE = (() => {
  const l = listeDeTest();
  return {
    verrou_id: l.verrouId,
    pris_le: l.prisLe,
    expire_le: l.expireLe,
    genere_le: l.genereLe,
    evenement_fr: l.evenementFr,
    evenement_en: l.evenementEn,
    cle_code_court: l.cleCodeCourt,
    types: l.types,
    pass: l.pass,
  };
})();

function faux(s: Partial<DependancesHorsLigne> = {}): DependancesHorsLigne {
  return {
    exigerAcces: vi.fn(async () => ({ auteur: AUTEUR })),
    exigerSession: vi.fn(async () => ({ auteur: AUTEUR })),
    exigerAdmin: vi.fn(async () => ({ auteur: AUTEUR })),
    prendre: vi.fn(async () => ({ erreur: null, reponse: { statut: "pris" } })),
    telecharger: vi.fn(async () => ({ erreur: null, reponse: REPONSE_LISTE })),
    synchroniser: vi.fn(async () => ({ erreur: null, reponse: { appliques: 1, conflits: 0, inconnus: 0, invalides: 0, deja_traites: 0 } })),
    liberer: vi.fn(async () => ({ erreur: null, reponse: { statut: "libere" } })),
    lireEtat: vi.fn(async () => ({ erreur: null, reponse: { etat: "libre" } })),
    forcer: vi.fn(async () => ({ erreur: null, reponse: { statut: "force" } })),
    consommerEssai: vi.fn(async () => ({ erreur: null, autorise: true })),
    empreinteValeur: vi.fn((v: string) => `TEST_hash_${v.length}`),
    ...s,
  };
}
const erreurBase = (code: string) => async () => ({ erreur: code, reponse: null });

let sortie: string[];
beforeEach(() => {
  sortie = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void sortie.push(a.join(" ")));
});

describe("prendre le Verrou et télécharger la liste", () => {
  it("droit d'abord, puis prise, puis liste relue : prise et liste reçoivent l'Événement et l'appareil", async () => {
    const d = faux();
    const r = await prendreEtTelecharger(d, ENTREE);
    expect(r).toMatchObject({ ok: true, liste: { evenementFr: "TEST_Festival", cleCodeCourt: "01".repeat(32) } });
    expect(d.exigerAcces).toHaveBeenCalledWith(TEST_EVENEMENT);
    expect(d.prendre).toHaveBeenCalledWith({ auteur: AUTEUR, evenementId: TEST_EVENEMENT, appareil: TEST_APPAREIL });
    expect(d.telecharger).toHaveBeenCalledTimes(1);
    if (r.ok) expect(r.liste.pass).toHaveLength(TEST_PASS.length);
  });
  it("sans droit sur cet Événement : ni prise ni liste", async () => {
    const d = faux({ exigerAcces: vi.fn(async () => { throw new Error("KS_DROIT_REFUSE"); }) });
    expect(await prendreEtTelecharger(d, ENTREE)).toEqual({ ok: false, erreur: "non_autorise" });
    expect(d.prendre).not.toHaveBeenCalled();
    expect(d.telecharger).not.toHaveBeenCalled();
    const e = faux({ exigerAcces: vi.fn(async () => { throw new Error("KS_NON_CONNECTE"); }) });
    expect(await prendreEtTelecharger(e, ENTREE)).toEqual({ ok: false, erreur: "non_connecte" });
  });
  it("Verrou tenu par un autre appareil : refus, aucune liste", async () => {
    const d = faux({ prendre: erreurBase("KS_VERROU_PRIS") });
    expect(await prendreEtTelecharger(d, ENTREE)).toEqual({ ok: false, erreur: "verrou_pris" });
    expect(d.telecharger).not.toHaveBeenCalled();
  });
  it("traduit les autres refus de la base", async () => {
    expect(await prendreEtTelecharger(faux({ prendre: erreurBase("KS_EVENEMENT_PASSE") }), ENTREE)).toEqual({ ok: false, erreur: "evenement_passe" });
    expect(await prendreEtTelecharger(faux({ telecharger: erreurBase("KS_VERROU_ABSENT") }), ENTREE)).toEqual({ ok: false, erreur: "verrou_absent" });
    expect(await prendreEtTelecharger(faux({ prendre: erreurBase("XX000") }), ENTREE)).toEqual({ ok: false, erreur: "generique" });
  });
  it("entrées invalides : rejetées avant tout appel", async () => {
    const d = faux();
    expect(await prendreEtTelecharger(d, { evenementId: "pas-un-uuid", appareil: TEST_APPAREIL })).toEqual({ ok: false, erreur: "evenement_invalide" });
    expect(await prendreEtTelecharger(d, { evenementId: TEST_EVENEMENT, appareil: "court" })).toEqual({ ok: false, erreur: "appareil_invalide" });
    expect(await prendreEtTelecharger(d, { evenementId: TEST_EVENEMENT, appareil: TEST_APPAREIL.toUpperCase() })).toEqual({ ok: false, erreur: "appareil_invalide" });
    expect(d.exigerAcces).not.toHaveBeenCalled();
  });
  it("liste de forme inattendue : jamais devinée", async () => {
    for (const reponse of [null, "x", {}, { ...REPONSE_LISTE, cle_code_court: "court" }, { ...REPONSE_LISTE, pass: [{ j: "x", c: "y", n: "z", t: 0 }] }, { ...REPONSE_LISTE, pass: [{ ...REPONSE_LISTE.pass[0], t: 9 }] }, { ...REPONSE_LISTE, types: "x" }]) {
      expect(await prendreEtTelecharger(faux({ telecharger: vi.fn(async () => ({ erreur: null, reponse })) }), ENTREE), JSON.stringify(reponse)).toEqual({ ok: false, erreur: "generique" });
    }
    expect(lireListe(REPONSE_LISTE)?.pass).toHaveLength(3);
  });
  it("les journaux ne gardent que le code KS_ : ni appareil, ni jeton, ni clé, ni nom", async () => {
    await prendreEtTelecharger(faux({ prendre: erreurBase("KS_VERROU_PRIS : TEST_appareil_" + TEST_APPAREIL) }), ENTREE);
    await prendreEtTelecharger(faux({ telecharger: vi.fn(async () => ({ erreur: null, reponse: { ...REPONSE_LISTE, cle_code_court: "x" } })) }), ENTREE);
    const tout = sortie.join("\n");
    expect(tout).toContain("KS_VERROU_PRIS");
    for (const secret of [TEST_APPAREIL, TEST_PASS[0].jeton, TEST_PASS[0].code, "01".repeat(32), "TEST_Alice"]) expect(tout).not.toContain(secret);
  });
});

describe("synchroniser les scans", () => {
  const SCAN = { id: "00000000-0000-4000-8000-0000000000a1", nature: "jeton", empreinte: "ab".repeat(32), scanneLe: "2027-01-10T09:00:00.000Z" };
  it("session seulement (la fenêtre du bénévole peut être passée) ; la forme envoyée à la base est celle de synchroniser_scans", async () => {
    const d = faux();
    const r = await synchroniserScans(d, { ...ENTREE, scans: [SCAN] });
    expect(r).toEqual({ ok: true, bilan: { appliques: 1, conflits: 0, inconnus: 0, invalides: 0, dejaTraites: 0 } });
    expect(d.exigerAcces).not.toHaveBeenCalled();
    expect(d.synchroniser).toHaveBeenCalledWith({
      auteur: AUTEUR,
      evenementId: TEST_EVENEMENT,
      appareil: TEST_APPAREIL,
      scans: [{ id: SCAN.id, nature: "jeton", empreinte: SCAN.empreinte, scanne_le: "2027-01-10T09:00:00.000Z" }],
    });
  });
  it("lot de plus de 200 scans : refusé avant tout appel ; 200 passent", async () => {
    const d = faux();
    const lot = (n: number) => Array.from({ length: n }, (_, i) => ({ ...SCAN, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
    expect(await synchroniserScans(d, { ...ENTREE, scans: lot(201) })).toEqual({ ok: false, erreur: "lot_trop_grand" });
    expect(d.synchroniser).not.toHaveBeenCalled();
    expect((await synchroniserScans(d, { ...ENTREE, scans: lot(200) })).ok).toBe(true);
  });
  it("scan mal formé (empreinte, nature, date, identifiant) : tout le lot est refusé, la base n'est pas appelée", async () => {
    const d = faux();
    for (const mauvais of [{ ...SCAN, empreinte: "KMNP2345" }, { ...SCAN, nature: "autre" }, { ...SCAN, scanneLe: "hier" }, { ...SCAN, id: "1" }, "x", null]) {
      expect(await synchroniserScans(d, { ...ENTREE, scans: [mauvais] })).toEqual({ ok: false, erreur: "generique" });
    }
    expect(await synchroniserScans(d, { ...ENTREE, scans: "x" })).toEqual({ ok: false, erreur: "generique" });
    expect(d.synchroniser).not.toHaveBeenCalled();
  });
  it("Verrou libéré de force, Verrou absent, session expirée, réponse illisible", async () => {
    expect(await synchroniserScans(faux({ synchroniser: erreurBase("KS_VERROU_LIBERE_DE_FORCE") }), { ...ENTREE, scans: [SCAN] })).toEqual({ ok: false, erreur: "verrou_libere_de_force" });
    expect(await synchroniserScans(faux({ synchroniser: erreurBase("KS_VERROU_ABSENT") }), { ...ENTREE, scans: [SCAN] })).toEqual({ ok: false, erreur: "verrou_absent" });
    expect(await synchroniserScans(faux({ exigerSession: vi.fn(async () => { throw new Error("KS_NON_CONNECTE"); }) }), { ...ENTREE, scans: [SCAN] })).toEqual({ ok: false, erreur: "non_connecte" });
    expect(await synchroniserScans(faux({ synchroniser: vi.fn(async () => ({ erreur: null, reponse: { appliques: "1" } })) }), { ...ENTREE, scans: [SCAN] })).toEqual({ ok: false, erreur: "generique" });
  });
});

describe("libérer, état, libération forcée", () => {
  it("libérer : réponse réelle de la base seulement", async () => {
    expect(await libererVerrou(faux(), ENTREE)).toEqual({ ok: true, statut: "libere" });
    expect(await libererVerrou(faux({ liberer: vi.fn(async () => ({ erreur: null, reponse: { statut: "force" } })) }), ENTREE)).toEqual({ ok: true, statut: "force" });
    expect(await libererVerrou(faux({ liberer: vi.fn(async () => ({ erreur: null, reponse: { statut: "ok" } })) }), ENTREE)).toEqual({ ok: false, erreur: "generique" });
    expect(await libererVerrou(faux({ liberer: erreurBase("KS_VERROU_ABSENT") }), ENTREE)).toEqual({ ok: false, erreur: "verrou_absent" });
  });
  it("état du Verrou : libre, autre, moi (avec la fin de la fenêtre) ; le droit de scanner cet Événement est exigé", async () => {
    expect(await lireEtatVerrou(faux(), ENTREE)).toEqual({ ok: true, etat: { etat: "libre" } });
    expect(await lireEtatVerrou(faux({ lireEtat: vi.fn(async () => ({ erreur: null, reponse: { etat: "autre" } })) }), ENTREE)).toEqual({ ok: true, etat: { etat: "autre" } });
    expect(await lireEtatVerrou(faux({ lireEtat: vi.fn(async () => ({ erreur: null, reponse: { etat: "moi", pris_le: "a", expire_le: "b" } })) }), ENTREE)).toEqual({ ok: true, etat: { etat: "moi", prisLe: "a", expireLe: "b" } });
    expect(await lireEtatVerrou(faux({ lireEtat: vi.fn(async () => ({ erreur: null, reponse: { etat: "moi" } })) }), ENTREE)).toEqual({ ok: false, erreur: "generique" });
    const d = faux({ exigerAcces: vi.fn(async () => { throw new Error("KS_DROIT_REFUSE"); }) });
    expect(await lireEtatVerrou(d, ENTREE)).toEqual({ ok: false, erreur: "non_autorise" });
    expect(d.lireEtat).not.toHaveBeenCalled();
  });
  it("libération forcée : Admin seulement, avant tout appel à la base", async () => {
    const refus = faux({ exigerAdmin: vi.fn(async () => { throw new Error("KS_DROIT_REFUSE"); }) });
    expect(await forcerLiberation(refus, { evenementId: TEST_EVENEMENT })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(refus.forcer).not.toHaveBeenCalled();
    const d = faux();
    expect(await forcerLiberation(d, { evenementId: TEST_EVENEMENT })).toEqual({ ok: true, statut: "force" });
    expect(d.forcer).toHaveBeenCalledWith({ auteur: AUTEUR, evenementId: TEST_EVENEMENT });
    expect(await forcerLiberation(faux({ forcer: vi.fn(async () => ({ erreur: null, reponse: { statut: "aucun" } })) }), { evenementId: TEST_EVENEMENT })).toEqual({ ok: true, statut: "aucun" });
    expect(await forcerLiberation(faux({ forcer: erreurBase("KS_DROIT_REFUSE") }), { evenementId: TEST_EVENEMENT })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await forcerLiberation(d, { evenementId: "x" })).toEqual({ ok: false, erreur: "evenement_invalide" });
  });
});

describe("scan en ligne et Verrou (service de la story 7.6)", () => {
  const AUTEUR_SCAN = { type: "compte" as const, id: COMPTE, role: "admin" };
  function fauxScan(s: Partial<DependancesScan> = {}): DependancesScan {
    return {
      exigerAcces: vi.fn(async () => ({ auteur: AUTEUR_SCAN })),
      empreinteValeur: vi.fn((v: string) => `TEST_${v.length}`),
      empreinteClient: vi.fn(async () => "TEST_ip"),
      consommerEssai: vi.fn(async () => ({ erreur: null, autorise: true })),
      scanner: vi.fn(async () => ({ erreur: null, reponse: null })),
      ...s,
    };
  }
  const qr = (extra: object = {}) => ({ evenementId: TEST_EVENEMENT, langue: "fr", charge: `KOMA:PASS:${TEST_PASS[0].jeton}`, ...extra });
  it("l'appareil est transmis à la base s'il est bien formé, sinon ignoré", async () => {
    const d = fauxScan();
    await scannerPass(d, qr({ appareil: TEST_APPAREIL }));
    expect(d.scanner).toHaveBeenLastCalledWith(expect.objectContaining({ appareil: TEST_APPAREIL }));
    await scannerPass(d, qr({ appareil: "n'importe quoi" }));
    expect(d.scanner).toHaveBeenLastCalledWith(expect.objectContaining({ appareil: null }));
  });
  it("Verrou tenu par un autre appareil : « verrouille », jamais VALIDE ni REFUSÉ", async () => {
    const d = fauxScan({ scanner: vi.fn(async () => ({ erreur: "KS_SCAN_VERROUILLE", reponse: null })) });
    expect(await scannerPass(d, qr())).toEqual({ ok: false, erreur: "verrouille" });
  });
});

describe("correctifs de revue : débit et bornes", () => {
  const SCAN = { id: "00000000-0000-4000-8000-0000000000a1", nature: "jeton", empreinte: "ab".repeat(32), scanneLe: "2027-01-10T09:00:00.000Z" };
  it("trop de prises de Verrou par Compte : refus avant toute écriture ; la clé ne contient pas l'identifiant du Compte en clair", async () => {
    const d = faux({ consommerEssai: vi.fn(async () => ({ erreur: null, autorise: false })) });
    expect(await prendreEtTelecharger(d, ENTREE)).toEqual({ ok: false, erreur: "trop_d_essais" });
    expect(d.prendre).not.toHaveBeenCalled();
    const cle = vi.mocked(d.consommerEssai).mock.calls[0][0].cle;
    expect(cle).toMatch(/^verrou:prendre:TEST_hash_/);
    expect(cle).not.toContain(COMPTE);
  });
  it("trop de lots de synchronisation : refus avant la base ; panne de la limite : erreur générique, jamais d'ouverture", async () => {
    const refus = faux({ consommerEssai: vi.fn(async () => ({ erreur: null, autorise: false })) });
    expect(await synchroniserScans(refus, { ...ENTREE, scans: [SCAN] })).toEqual({ ok: false, erreur: "trop_d_essais" });
    expect(refus.synchroniser).not.toHaveBeenCalled();
    const panne = faux({ consommerEssai: vi.fn(async () => ({ erreur: "XX000", autorise: false })) });
    expect(await synchroniserScans(panne, { ...ENTREE, scans: [SCAN] })).toEqual({ ok: false, erreur: "generique" });
    expect(panne.synchroniser).not.toHaveBeenCalled();
  });
  it("réponse démesurée de la base : refusée", () => {
    const trop = (r: object) => lireListe({ ...REPONSE_LISTE, ...r });
    expect(trop({})).not.toBeNull();
    expect(trop({ evenement_fr: "x".repeat(301) })).toBeNull();
    expect(trop({ types: Array.from({ length: 51 }, () => ({ fr: "a", en: null })) })).toBeNull();
    expect(trop({ pass: [{ ...REPONSE_LISTE.pass[0], n: "x".repeat(81) }] })).toBeNull();
    expect(trop({ pass: new Array(20001).fill(REPONSE_LISTE.pass[0]) })).toBeNull();
  });
});
