import { beforeEach, describe, expect, it, vi } from "vitest";
import { construireAuteur } from "@/lib/auth/auteur";
import { creerCommande, lireRecapitulatif } from "@/modules/commande/service";
import type { DependancesCommande, RecapBrut } from "@/modules/commande/types";

const PRODUIT = "00000000-0000-4000-8000-0000000000aa";
const PANIER = "00000000-0000-4000-8000-0000000000bb";
const CLE = "TEST_cle-0001";

function recapBrut(s: Partial<RecapBrut> = {}): RecapBrut {
  return {
    lignes: [
      {
        ligne_id: "00000000-0000-4000-8000-0000000000c1",
        produit_id: PRODUIT,
        famille: "cosplay",
        slug: "test-cosplay",
        titre_fr: "TEST_Cosplay",
        titre_en: "TEST_Cosplay en",
        taille: "M",
        nombre: 2,
        prix_cents: 5000,
        etat: "sur_commande",
        origine: "fabrication",
        delai_fabrication_jours: 14,
      },
    ],
    physique: true,
    kit: false,
    sur_mesure: false,
    sous_total_cents: 10000,
    forfait_cents: 500,
    total_cents: 10500,
    indisponible: false,
    remise_manquante: false,
    empreinte: "0123456789abcdef0123456789abcdef",
    ...s,
  };
}

function faux(s: Partial<DependancesCommande> = {}): DependancesCommande {
  return {
    exigerCompte: vi.fn(async () => ({ compteId: "TEST_compte", auteur: construireAuteur("TEST_compte") })),
    panierDuCompte: vi.fn(async () => PANIER),
    offrirCommande: vi.fn(async () => ({ erreur: null, numero: "KS-2026-000001" })),
    recapitulatif: vi.fn(async () => ({ recap: recapBrut() })),
    creerCommande: vi.fn(async () => ({ numero: "KS-2026-000007", expireLe: "2026-11-01T12:30:00Z" })),
    donnerConsentementEmails: vi.fn(async () => undefined),
    ...s,
  };
}

const refus = (code: string) => async () => {
  throw Object.assign(new Error(code), { code });
};

const commande = {
  zone: "goma" as const,
  mode: "livraison" as const,
  telephone: "+243990000000",
  adresse: "TEST_adresse",
  acceptations: { cgv: true },
  totalAttenduCents: 10500,
  empreinte: "0123456789abcdef0123456789abcdef",
  cleIdempotence: CLE,
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("lireRecapitulatif", () => {
  it("renvoie le Récapitulatif relu en base, titre dans la langue", async () => {
    const deps = faux();
    const r = await lireRecapitulatif(deps, { zone: "goma", mode: "livraison" }, "en");
    expect(r).toMatchObject({ ok: true, recap: { totalCents: 10500, forfaitCents: 500, physique: true } });
    expect(r.ok && r.recap.lignes[0].titre).toBe("TEST_Cosplay en");
    expect(deps.recapitulatif).toHaveBeenCalledWith({ compteId: "TEST_compte", panierId: PANIER, zone: "goma", mode: "livraison", code: null });
  });

  it("refuse Bukavu avec retrait, ou une Zone sans Mode, sans interroger la base", async () => {
    const deps = faux();
    await expect(lireRecapitulatif(deps, { zone: "bukavu", mode: "retrait" }, "fr")).resolves.toEqual({ ok: false, erreur: "remise" });
    await expect(lireRecapitulatif(deps, { zone: "goma" }, "fr")).resolves.toEqual({ ok: false, erreur: "remise" });
    expect(deps.recapitulatif).not.toHaveBeenCalled();
  });

  it("sans Panier utilisable : panier_vide ; non connecté : non_connecte", async () => {
    await expect(lireRecapitulatif(faux({ panierDuCompte: vi.fn(async () => null) }), {}, "fr")).resolves.toEqual({ ok: false, erreur: "panier_vide" });
    await expect(lireRecapitulatif(faux({ exigerCompte: refus("KS_NON_CONNECTE") }), {}, "fr")).resolves.toEqual({ ok: false, erreur: "non_connecte" });
  });

  it("une ligne indisponible bloque ; une ligne d'état inconnu est écartée et bloque aussi", async () => {
    const hors = faux({ recapitulatif: vi.fn(async () => ({ recap: recapBrut({ indisponible: true }) })) });
    const r = await lireRecapitulatif(hors, {}, "fr");
    expect(r.ok && r.recap.indisponible).toBe(true);
    const inconnue = faux({ recapitulatif: vi.fn(async () => ({ recap: recapBrut({ lignes: [{ ...recapBrut().lignes[0], etat: "magique" }] }) })) });
    const r2 = await lireRecapitulatif(inconnue, {}, "fr");
    expect(r2.ok && r2.recap.lignes).toEqual([]);
    expect(r2.ok && r2.recap.indisponible).toBe(true);
  });
});

describe("creerCommande", () => {
  it("envoie à la base le Compte de la session, le Panier du cookie, le total vu et les acceptations avec leur version", async () => {
    const deps = faux();
    const r = await creerCommande(deps, { ...commande, acceptations: { cgv: true, kit: true, surMesure: true }, origine: "tiktok" }, "fr");
    expect(r).toEqual({ ok: true, numero: "KS-2026-000007", expireLe: "2026-11-01T12:30:00Z" });
    expect(deps.creerCommande).toHaveBeenCalledWith({
      auteur: { type: "compte", id: "TEST_compte", role: null },
      panierId: PANIER,
      zone: "goma",
      mode: "livraison",
      telephone: "+243990000000",
      adresse: "TEST_adresse",
      acceptations: [
        { objet: "cgv", version: expect.any(String) },
        { objet: "kit_acces_immediat", version: expect.any(String) },
        { objet: "sur_mesure", version: expect.any(String) },
      ],
      origine: "tiktok",
      totalAttenduCents: 10500,
      empreinte: "0123456789abcdef0123456789abcdef",
      cleIdempotence: CLE,
      code: null,
    });
  });

  it("story 9.4 : case Emails commerciaux cochée → consentement après la Commande créée ; non cochée ou Commande refusée → aucun", async () => {
    const a = faux();
    expect(await creerCommande(a, { ...commande, emails: true }, "fr")).toMatchObject({ ok: true });
    expect(a.donnerConsentementEmails).toHaveBeenCalledWith({ type: "compte", id: "TEST_compte", role: null });
    const b = faux();
    await creerCommande(b, { ...commande }, "fr");
    expect(b.donnerConsentementEmails).not.toHaveBeenCalled();
    const c = faux({ creerCommande: vi.fn(async () => ({ erreur: "KS_COMMANDE_EN_ATTENTE" })) });
    await creerCommande(c, { ...commande, emails: true }, "fr");
    expect(c.donnerConsentementEmails).not.toHaveBeenCalled();
  });

  it("story 9.4 : un consentement en échec ne transforme jamais une Commande créée en échec", async () => {
    const d = faux({ donnerConsentementEmails: vi.fn(async () => { throw new Error("TEST_panne"); }) });
    expect(await creerCommande(d, { ...commande, emails: true }, "fr")).toEqual({ ok: true, numero: "KS-2026-000007", expireLe: "2026-11-01T12:30:00Z" });
  });

  it("une case non cochée n'est pas envoyée (la base refuse alors)", async () => {
    const deps = faux();
    await creerCommande(deps, { ...commande, acceptations: { cgv: false } }, "fr");
    expect(deps.creerCommande).toHaveBeenCalledWith(expect.objectContaining({ acceptations: [] }));
  });

  it("refuse une entrée invalide sans toucher à la base : Bukavu en retrait, clé courte, origine hostile", async () => {
    const deps = faux();
    await expect(creerCommande(deps, { ...commande, zone: "bukavu", mode: "retrait" }, "fr")).resolves.toEqual({ ok: false, erreur: "invalide" });
    await expect(creerCommande(deps, { ...commande, cleIdempotence: "court" }, "fr")).resolves.toEqual({ ok: false, erreur: "invalide" });
    await expect(creerCommande(deps, { ...commande, origine: "x'; drop table" }, "fr")).resolves.toEqual({ ok: false, erreur: "invalide" });
    await expect(creerCommande(deps, { ...commande, empreinte: "pas-une-empreinte" }, "fr")).resolves.toEqual({ ok: false, erreur: "invalide" });
    expect(deps.creerCommande).not.toHaveBeenCalled();
  });

  it("total changé : rien n'est créé, le nouveau Récapitulatif est renvoyé pour une nouvelle confirmation", async () => {
    const deps = faux({
      creerCommande: vi.fn(async () => ({ erreur: "KS_TOTAL_CHANGE" })),
      recapitulatif: vi.fn(async () => ({ recap: recapBrut({ total_cents: 11000 }) })),
    });
    const r = await creerCommande(deps, commande, "fr");
    expect(r).toMatchObject({ ok: false, erreur: "total_change", recap: { totalCents: 11000 } });
  });

  it("même total mais disponibilité ou délai changés : « recap_change », rien n'est créé, le nouveau Récapitulatif est renvoyé", async () => {
    const deps = faux({
      creerCommande: vi.fn(async () => ({ erreur: "KS_RECAP_CHANGE" })),
      recapitulatif: vi.fn(async () => ({ recap: recapBrut({ empreinte: "ffffffffffffffffffffffffffffffff" }) })),
    });
    const r = await creerCommande(deps, commande, "fr");
    expect(r).toMatchObject({ ok: false, erreur: "recap_change", recap: { empreinte: "ffffffffffffffffffffffffffffffff" } });
  });

  it.each([
    ["KS_ACCEPTATION_MANQUANTE", "acceptation"],
    ["KS_COMMANDE_EN_ATTENTE", "commande_en_attente"],
    ["KS_TELEPHONE_INVALIDE", "telephone"],
    ["KS_ADRESSE_MANQUANTE", "adresse"],
    ["KS_REMISE_MANQUANTE", "remise"],
    ["KS_INDISPONIBLE", "indisponible"],
    ["KS_KIT_DEJA_POSSEDE", "deja_possede"],
    ["KS_REGLAGE_MANQUANT", "reglage_manquant"],
    ["KS_PANIER_VIDE", "panier_vide"],
    ["KS_PANIER_INTROUVABLE", "panier_introuvable"],
  ])("traduit le refus %s de la base en %s", async (codeBase, attendu) => {
    const deps = faux({ creerCommande: vi.fn(async () => ({ erreur: codeBase })) });
    await expect(creerCommande(deps, commande, "fr")).resolves.toEqual({ ok: false, erreur: attendu });
  });

  it("sans Panier utilisable ou non connecté : rien n'est créé", async () => {
    const sans = faux({ panierDuCompte: vi.fn(async () => null) });
    await expect(creerCommande(sans, commande, "fr")).resolves.toEqual({ ok: false, erreur: "panier_vide" });
    const non = faux({ exigerCompte: refus("KS_NON_CONNECTE") });
    await expect(creerCommande(non, commande, "fr")).resolves.toEqual({ ok: false, erreur: "non_connecte" });
    expect(sans.creerCommande).not.toHaveBeenCalled();
    expect(non.creerCommande).not.toHaveBeenCalled();
  });

  it("erreur inconnue ou exception : jamais un succès, rien de personnel dans le journal", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const inconnue = faux({ creerCommande: vi.fn(async () => ({ erreur: "détail secret +243990000000" })) });
    await expect(creerCommande(inconnue, commande, "fr")).resolves.toEqual({ ok: false, erreur: "erreur" });
    const exception = faux({ creerCommande: vi.fn(async () => { throw new Error("réseau +243990000000"); }) });
    await expect(creerCommande(exception, commande, "fr")).resolves.toEqual({ ok: false, erreur: "erreur" });
    const texte = spy.mock.calls.flat().join(" ");
    expect(texte).not.toContain("243990000000");
    expect(texte).not.toContain("secret");
  });
});
