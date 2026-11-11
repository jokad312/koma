// Story 7.8 : Scan hors ligne, côté appareil. Empreintes (Web Crypto, recoupées avec pgcrypto), stockage IndexedDB (fake-indexeddb, données TEST_), comparaison
// locale (même verdict que le scan en ligne), un même Pass refusé la seconde fois, synchronisation puis libération puis effacement.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { creerLimiteurEssais, indexerListe, noterScanEnLigne, scannerLocalement, type DependancesLocales } from "@/modules/scan/comparaison-locale";
import { depuisHex, empreinteCodeCourt, empreinteJeton, importerCleCodeCourt, nouvelIdentifiantAppareil, versHex } from "@/modules/scan/empreintes";
import { MOTIF_APPAREIL } from "@/modules/scan/hors-ligne-types";
import { listeDepuisReponse, ouvrirStockage, stockageDisponible, type Stockage } from "@/modules/scan/stockage-hors-ligne";
import { synchroniserEtLiberer } from "@/modules/scan/synchronisation";
import { hmac, listeDeTest, sha256, TEST_CLE_HEX, TEST_EVENEMENT, TEST_PASS } from "../doubles/TEST_liste-hors-ligne";

const MAINTENANT = new Date("2027-01-10T09:00:00.000Z");
let compteur = 0;
const nouvelId = () => `00000000-0000-4000-8000-${String(++compteur).padStart(12, "0")}`;

async function pret() {
  const stockage = await ouvrirStockage(new IDBFactory());
  const cle = await importerCleCodeCourt(TEST_CLE_HEX);
  const liste = listeDepuisReponse(TEST_EVENEMENT, listeDeTest(), cle);
  await stockage.enregistrerListe(liste);
  const idx = indexerListe((await stockage.lireListe(TEST_EVENEMENT)) as NonNullable<Awaited<ReturnType<Stockage["lireListe"]>>>);
  const deps: DependancesLocales = { stockage, maintenant: () => MAINTENANT, nouvelId, langue: "fr" };
  return { stockage, idx, deps };
}

beforeEach(() => {
  compteur = 0;
});

describe("empreintes (Web Crypto)", () => {
  it("SHA-256 du jeton : même valeur que pgcrypto digest(jeton, 'sha256') sur koma-dev", async () => {
    expect(await empreinteJeton("ab".repeat(24))).toBe("5e00ea51cf17ae5f52490c2be595cbcd6efdf5c30c17e1956e89e30e5047c7c9");
    expect(await empreinteJeton("AB".repeat(24))).toBe(await empreinteJeton("ab".repeat(24)));
  });
  it("HMAC-SHA-256 du code court : même valeur que pgcrypto hmac(code, clé, 'sha256') sur koma-dev", async () => {
    const cle = await importerCleCodeCourt(TEST_CLE_HEX);
    expect(await empreinteCodeCourt("KMNP2345", cle)).toBe("72855e028e312777d4d325422b8f545423ffa51d7506921a3ad1aa9e68779597");
    expect(await empreinteCodeCourt("kmnp2345", cle)).toBe("72855e028e312777d4d325422b8f545423ffa51d7506921a3ad1aa9e68779597");
  });
  it("la clé du HMAC est importée NON extractible : ses octets ne peuvent plus être relus", async () => {
    const cle = await importerCleCodeCourt(TEST_CLE_HEX);
    expect(cle.extractable).toBe(false);
    expect(cle.usages).toEqual(["sign"]);
    await expect(globalThis.crypto.subtle.exportKey("raw", cle)).rejects.toThrow();
  });
  it("une autre clé donne une autre empreinte (le SHA-256 simple du code ne suffit pas)", async () => {
    const autre = await importerCleCodeCourt("02".repeat(32));
    expect(await empreinteCodeCourt("KMNP2345", autre)).not.toBe(await empreinteCodeCourt("KMNP2345", await importerCleCodeCourt(TEST_CLE_HEX)));
    expect(hmac("KMNP2345")).not.toBe(sha256("KMNP2345"));
  });
  it("hexadécimal et identifiant d'appareil", () => {
    expect(versHex(depuisHex("00ff10"))).toBe("00ff10");
    expect(() => depuisHex("zz")).toThrow();
    expect(nouvelIdentifiantAppareil()).toMatch(MOTIF_APPAREIL);
    expect(nouvelIdentifiantAppareil()).not.toBe(nouvelIdentifiantAppareil());
  });
});

describe("stockage IndexedDB", () => {
  it("indisponible sans IndexedDB", async () => {
    expect(stockageDisponible(null as unknown as IDBFactory)).toBe(false);
    await expect(ouvrirStockage(null as unknown as IDBFactory)).rejects.toThrow();
  });
  it("l'identifiant d'appareil est tiré une fois puis relu", async () => {
    const fabrique = new IDBFactory();
    const a = await (await ouvrirStockage(fabrique)).lireAppareil();
    const b = await (await ouvrirStockage(fabrique)).lireAppareil();
    expect(a).toMatch(MOTIF_APPAREIL);
    expect(b).toBe(a);
  });
  it("la liste est gardée avec une CryptoKey non extractible, sans jeton ni code court en clair", async () => {
    const { stockage } = await pret();
    const lue = await stockage.lireListe(TEST_EVENEMENT);
    expect(lue?.pass).toHaveLength(3);
    expect(lue?.cle.extractable).toBe(false);
    const brut = JSON.stringify({ ...lue, cle: undefined });
    for (const p of TEST_PASS) {
      expect(brut).not.toContain(p.jeton);
      expect(brut).not.toContain(p.code);
    }
    expect(brut).not.toContain(TEST_CLE_HEX);
  });
  it("deux scans VALIDE du même Pass ne s'enregistrent qu'une fois (index unique)", async () => {
    const { stockage } = await pret();
    const base = { evenementId: TEST_EVENEMENT, passJ: "p", cleDoublon: `${TEST_EVENEMENT}|p`, nature: "jeton" as const, empreinte: "e", origine: "hors_ligne" as const, resultat: "valide" as const, synchronise: 0 as const };
    const [r1, r2] = await Promise.all([
      stockage.enregistrerScan({ ...base, id: nouvelId(), scanneLe: "2027-01-10T09:00:00.000Z" }),
      stockage.enregistrerScan({ ...base, id: nouvelId(), scanneLe: "2027-01-10T09:00:01.000Z" }),
    ]);
    expect([r1.statut, r2.statut].sort()).toEqual(["deja", "enregistre"]);
    expect(await stockage.compterEnAttente(TEST_EVENEMENT)).toBe(1);
  });
});

describe("comparaison locale : même verdict que le scan en ligne", () => {
  it("VALIDE par le Code QR : nom, Événement, Type de pass (français, puis anglais avec repli)", async () => {
    const { idx, deps } = await pret();
    expect(await scannerLocalement(deps, idx, { charge: `KOMA:PASS:${TEST_PASS[0].jeton}` })).toEqual({
      ok: true,
      resultat: "valide",
      nom: "TEST_Alice",
      evenement: "TEST_Festival",
      typePass: "TEST_VIP",
    });
    // Type sans traduction anglaise : le français sert de repli, comme en ligne.
    expect(await scannerLocalement({ ...deps, langue: "en" }, idx, { charge: `KOMA:PASS:${TEST_PASS[1].jeton}` })).toMatchObject({ evenement: "TEST_Festival EN", typePass: "TEST_Simple", nom: "TEST_Bob" });
  });
  it("VALIDE par le code court (saisie libre : minuscules, tirets)", async () => {
    const { idx, deps } = await pret();
    expect(await scannerLocalement(deps, idx, { code: "kmnp-2345" })).toMatchObject({ ok: true, resultat: "valide", nom: "TEST_Alice" });
  });
  it("un même Pass scanné deux fois hors ligne est refusé la seconde fois, même par l'autre voie (QR puis code court)", async () => {
    const { idx, deps } = await pret();
    expect((await scannerLocalement(deps, idx, { charge: `KOMA:PASS:${TEST_PASS[0].jeton}` })).ok).toBe(true);
    const second = await scannerLocalement({ ...deps, maintenant: () => new Date("2027-01-10T09:05:00.000Z") }, idx, { code: TEST_PASS[0].code });
    expect(second).toEqual({ ok: true, resultat: "refuse", raison: "deja_scanne", scanneLe: MAINTENANT.toISOString() });
    expect(await scannerLocalement(deps, idx, { charge: `KOMA:PASS:${TEST_PASS[0].jeton}` })).toMatchObject({ resultat: "refuse", raison: "deja_scanne" });
  });
  it("Pass absent de la liste, code mal formé, Code QR étranger : REFUSÉ, sans toucher aux Pass", async () => {
    const { idx, deps, stockage } = await pret();
    expect(await scannerLocalement(deps, idx, { charge: `KOMA:PASS:${"99".repeat(24)}` })).toMatchObject({ resultat: "refuse", raison: "inconnu" });
    expect(await scannerLocalement(deps, idx, { code: "ZZZZZZZ9" })).toMatchObject({ resultat: "refuse", raison: "inconnu" });
    expect(await scannerLocalement(deps, idx, { code: "KMNP23" })).toMatchObject({ resultat: "refuse", raison: "inconnu" });
    expect(await scannerLocalement(deps, idx, { charge: "https://exemple.test/promo" })).toMatchObject({ resultat: "refuse", raison: "qr_invalide" });
    expect(await stockage.compterEnAttente(TEST_EVENEMENT)).toBe(0);
  });
  it("liste expirée : ni VALIDE ni REFUSÉ", async () => {
    const { idx, deps } = await pret();
    expect(await scannerLocalement({ ...deps, maintenant: () => new Date("2027-01-10T22:00:00.000Z") }, idx, { code: "KMNP2345" })).toEqual({ ok: false, erreur: "liste_expiree" });
  });
  it("si le scan ne peut pas être gardé sur l'appareil, VALIDE n'est jamais affiché", async () => {
    const { idx } = await pret();
    const casse: DependancesLocales = { stockage: { enregistrerScan: vi.fn(async () => { throw new Error("TEST_quota"); }) }, maintenant: () => MAINTENANT, nouvelId, langue: "fr" };
    expect(await scannerLocalement(casse, idx, { code: "KMNP2345" })).toEqual({ ok: false, erreur: "stockage" });
  });
  it("un Pass accepté en ligne par l'appareil est noté : hors ligne, il est refusé comme déjà scanné", async () => {
    const { idx, deps, stockage } = await pret();
    await noterScanEnLigne(deps, idx, { code: TEST_PASS[2].code });
    expect(await scannerLocalement(deps, idx, { charge: `KOMA:PASS:${TEST_PASS[2].jeton}` })).toMatchObject({ resultat: "refuse", raison: "deja_scanne" });
    // Déjà connu du serveur : rien à renvoyer à la synchronisation.
    expect(await stockage.compterEnAttente(TEST_EVENEMENT)).toBe(0);
  });
  it("la saisie à la main hors ligne est freinée (10 essais par 10 minutes)", () => {
    const limiteur = creerLimiteurEssais();
    for (let i = 0; i < 10; i++) expect(limiteur.autoriser(1000 + i)).toBe(true);
    expect(limiteur.autoriser(2000)).toBe(false);
    expect(limiteur.autoriser(1000 + 600_001)).toBe(true);
  });
});

describe("synchronisation puis libération puis effacement", () => {
  async function avecDeuxScans() {
    const c = await pret();
    await scannerLocalement(c.deps, c.idx, { charge: `KOMA:PASS:${TEST_PASS[0].jeton}` });
    await scannerLocalement({ ...c.deps, maintenant: () => new Date("2027-01-10T09:01:00.000Z") }, c.idx, { code: TEST_PASS[1].code });
    return c;
  }
  const bilan = { appliques: 2, conflits: 0, inconnus: 0, invalides: 0, dejaTraites: 0 };

  it("envoie des empreintes (jamais le jeton ni le code court), puis rend le Verrou, puis efface la liste", async () => {
    const { stockage } = await avecDeuxScans();
    const ordre: string[] = [];
    const synchroniser = vi.fn(async (e: { scans: unknown[] }) => {
      ordre.push("synchroniser");
      expect(JSON.stringify(e)).not.toContain(TEST_PASS[0].jeton);
      expect(JSON.stringify(e)).not.toContain(TEST_PASS[1].code);
      expect(e.scans).toHaveLength(2);
      return { ok: true as const, bilan };
    });
    const liberer = vi.fn(async () => {
      ordre.push("liberer");
      expect(await stockage.lireListe(TEST_EVENEMENT)).not.toBeNull();
      return { ok: true as const, statut: "libere" as const };
    });
    const r = await synchroniserEtLiberer({ stockage, synchroniser, liberer }, TEST_EVENEMENT, "a".repeat(32));
    expect(r).toEqual({ statut: "libere", bilan });
    expect(ordre).toEqual(["synchroniser", "liberer"]);
    expect(await stockage.lireListe(TEST_EVENEMENT)).toBeNull();
    expect(await stockage.compterEnAttente(TEST_EVENEMENT)).toBe(0);
  });
  it("les scans partent dans l'ordre de leur heure, avec leur nature (jeton ou code)", async () => {
    const { stockage } = await avecDeuxScans();
    const synchroniser = vi.fn(async (...[]: [{ scans: { nature: string; scanneLe: string }[] }]) => ({ ok: true as const, bilan }));
    await synchroniserEtLiberer({ stockage, synchroniser, liberer: async () => ({ ok: true, statut: "libere" }) }, TEST_EVENEMENT, "a".repeat(32));
    expect(synchroniser.mock.calls[0][0].scans.map((s) => s.nature)).toEqual(["jeton", "code"]);
    expect(synchroniser.mock.calls[0][0].scans[0].scanneLe < synchroniser.mock.calls[0][0].scans[1].scanneLe).toBe(true);
  });
  it("lots de 200 au plus", async () => {
    const { stockage } = await pret();
    for (let i = 0; i < 450; i++) {
      await stockage.enregistrerScan({ id: nouvelId(), evenementId: TEST_EVENEMENT, cleDoublon: `${TEST_EVENEMENT}|${i}`, passJ: String(i), nature: "jeton", empreinte: "e".repeat(64), scanneLe: new Date(1_800_000_000_000 + i).toISOString(), origine: "hors_ligne", resultat: "valide", synchronise: 0 });
    }
    const tailles: number[] = [];
    const synchroniser = vi.fn(async (e: { scans: unknown[] }) => {
      tailles.push(e.scans.length);
      return { ok: true as const, bilan };
    });
    await synchroniserEtLiberer({ stockage, synchroniser, liberer: async () => ({ ok: true, statut: "libere" }) }, TEST_EVENEMENT, "a".repeat(32));
    expect(tailles).toEqual([200, 200, 50]);
  });
  it("réseau coupé en cours de route : rien n'est perdu, le Verrou n'est pas rendu, la liste reste, la suite repart du bon scan", async () => {
    const { stockage } = await avecDeuxScans();
    const liberer = vi.fn();
    const r = await synchroniserEtLiberer({ stockage, synchroniser: async () => { throw new TypeError("TEST_Failed to fetch"); }, liberer }, TEST_EVENEMENT, "a".repeat(32));
    expect(r.statut).toBe("echec");
    expect(liberer).not.toHaveBeenCalled();
    expect(await stockage.lireListe(TEST_EVENEMENT)).not.toBeNull();
    expect(await stockage.compterEnAttente(TEST_EVENEMENT)).toBe(2);
  });
  it("erreur du serveur : les scans restent en attente (aucun n'est marqué envoyé sans réponse réelle)", async () => {
    const { stockage } = await avecDeuxScans();
    const r = await synchroniserEtLiberer({ stockage, synchroniser: async () => ({ ok: false, erreur: "generique" }), liberer: vi.fn() }, TEST_EVENEMENT, "a".repeat(32));
    expect(r).toMatchObject({ statut: "echec", erreur: "generique", restants: 2 });
  });
  it("Verrou plus valable pour le serveur : les scans sont gardés, rien n'est effacé", async () => {
    const { stockage } = await avecDeuxScans();
    const r = await synchroniserEtLiberer({ stockage, synchroniser: async () => ({ ok: false, erreur: "verrou_absent" }), liberer: vi.fn() }, TEST_EVENEMENT, "a".repeat(32));
    expect(r).toMatchObject({ statut: "perdu", restants: 2 });
    expect(await stockage.lireListe(TEST_EVENEMENT)).not.toBeNull();
  });
  it("synchronisation réussie mais libération en échec : la liste n'est pas effacée", async () => {
    const { stockage } = await avecDeuxScans();
    const r = await synchroniserEtLiberer({ stockage, synchroniser: async () => ({ ok: true, bilan }), liberer: async () => ({ ok: false, erreur: "generique" }) }, TEST_EVENEMENT, "a".repeat(32));
    expect(r.statut).toBe("echec");
    expect(await stockage.lireListe(TEST_EVENEMENT)).not.toBeNull();
    // Les scans déjà envoyés ne repartent pas au prochain essai.
    expect(await stockage.compterEnAttente(TEST_EVENEMENT)).toBe(0);
  });
  it("aucun scan en attente : seul le Verrou est rendu", async () => {
    const { stockage } = await pret();
    const synchroniser = vi.fn();
    const r = await synchroniserEtLiberer({ stockage, synchroniser, liberer: async () => ({ ok: true, statut: "libere" }) }, TEST_EVENEMENT, "a".repeat(32));
    expect(r.statut).toBe("libere");
    expect(synchroniser).not.toHaveBeenCalled();
  });
});

describe("correctifs de revue : aucun scan perdu", () => {
  const bilan = { appliques: 1, conflits: 0, inconnus: 0, invalides: 0, dejaTraites: 0 };
  const scanBrut = (n: number) => ({ id: nouvelId(), evenementId: TEST_EVENEMENT, cleDoublon: `${TEST_EVENEMENT}|x${n}`, passJ: `x${n}`, nature: "jeton" as const, empreinte: "e".repeat(64), scanneLe: new Date(1_800_000_000_000 + n).toISOString(), origine: "hors_ligne" as const, resultat: "valide" as const, synchronise: 0 as const });

  it("un scan jugé pendant l'envoi est relu et envoyé à la passe suivante, avant de rendre le Verrou", async () => {
    const { stockage } = await pret();
    await stockage.enregistrerScan(scanBrut(1));
    let appels = 0;
    const synchroniser = vi.fn(async (e: { scans: unknown[] }) => {
      appels++;
      if (appels === 1) await stockage.enregistrerScan(scanBrut(2));
      return { ok: true as const, bilan: { ...bilan, appliques: e.scans.length } };
    });
    const r = await synchroniserEtLiberer({ stockage, synchroniser, liberer: async () => ({ ok: true, statut: "libere" }) }, TEST_EVENEMENT, "a".repeat(32));
    expect(r.statut).toBe("libere");
    expect(synchroniser).toHaveBeenCalledTimes(2);
    expect(r.statut === "libere" && r.bilan.appliques).toBe(2);
  });

  it("un scan arrivé après la dernière relecture n'est jamais effacé : il reste, et l'écran le dit", async () => {
    const { stockage } = await pret();
    await stockage.enregistrerScan(scanBrut(1));
    const r = await synchroniserEtLiberer(
      {
        stockage,
        synchroniser: async () => ({ ok: true, bilan }),
        liberer: async () => {
          await stockage.enregistrerScan(scanBrut(2));
          return { ok: true, statut: "libere" };
        },
      },
      TEST_EVENEMENT,
      "a".repeat(32),
    );
    expect(r).toMatchObject({ statut: "perdu", restants: 1 });
    expect(await stockage.compterEnAttente(TEST_EVENEMENT)).toBe(1);
    expect(await stockage.lireListe(TEST_EVENEMENT)).toBeNull();
  });

  it("des scans encore en attente après les passes : le Verrou n'est pas rendu", async () => {
    const { stockage } = await pret();
    await stockage.enregistrerScan(scanBrut(1));
    const liberer = vi.fn();
    const r = await synchroniserEtLiberer(
      {
        stockage,
        // Chaque passe fait arriver un nouveau scan : la relecture finale en trouve encore.
        synchroniser: async () => {
          await stockage.enregistrerScan(scanBrut(Math.floor(Math.random() * 1e9)));
          return { ok: true, bilan };
        },
        liberer,
      },
      TEST_EVENEMENT,
      "a".repeat(32),
    );
    expect(r.statut).toBe("echec");
    expect(liberer).not.toHaveBeenCalled();
  });

  it("Verrou forcé : le serveur accepte la synchronisation (conflits seulement) puis la libération répond « force » ; tout est effacé", async () => {
    const { stockage } = await pret();
    await stockage.enregistrerScan(scanBrut(1));
    const r = await synchroniserEtLiberer({ stockage, synchroniser: async () => ({ ok: true, bilan }), liberer: async () => ({ ok: true, statut: "force" }) }, TEST_EVENEMENT, "a".repeat(32));
    expect(r.statut).toBe("libere");
    expect(await stockage.lireListe(TEST_EVENEMENT)).toBeNull();
  });

  it("autre Compte sur le même appareil : listes effacées, scans envoyés effacés, scans en attente gardés ; même Compte : rien ne change", async () => {
    const { stockage } = await pret();
    expect(await stockage.changerDeCompte("compte-A")).toBe(false);
    await stockage.enregistrerScan(scanBrut(1));
    expect(await stockage.changerDeCompte("compte-A")).toBe(false);
    expect(await stockage.lireListe(TEST_EVENEMENT)).not.toBeNull();
    expect(await stockage.changerDeCompte("compte-B")).toBe(true);
    expect(await stockage.lireListe(TEST_EVENEMENT)).toBeNull();
    expect(await stockage.compterEnAttente(TEST_EVENEMENT)).toBe(1);
    expect(await stockage.changerDeCompte("compte-B")).toBe(false);
  });
});
