import { beforeEach, describe, expect, it, vi } from "vitest";
import { construireAuteur } from "@/lib/auth/auteur";
import { creerCommande, lireRecapitulatif } from "@/modules/commande/service";
import type { DependancesCommande, RecapBrut } from "@/modules/commande/types";

const PANIER = "00000000-0000-4000-8000-0000000000bb";

function recapBrut(s: Partial<RecapBrut> = {}): RecapBrut {
  return {
    lignes: [
      {
        ligne_id: "00000000-0000-4000-8000-0000000000c1",
        produit_id: "00000000-0000-4000-8000-0000000000aa",
        famille: "cosplay",
        slug: "test-cosplay",
        titre_fr: "TEST_Cosplay",
        titre_en: null,
        taille: "M",
        nombre: 2,
        prix_cents: 5000,
        etat: "disponible",
        origine: "stock",
        delai_fabrication_jours: null,
        reduction_cents: 1000,
      },
    ],
    physique: true,
    kit: false,
    sur_mesure: false,
    sous_total_cents: 10000,
    forfait_cents: 500,
    reduction_cents: 1000,
    total_cents: 9500,
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
    recapitulatif: vi.fn(async () => ({ recap: recapBrut({ code: { valide: true, code: "PROMO10", reduction_pct: "10.00", commission_pct: 5 } as never }) })),
    creerCommande: vi.fn(async () => ({ numero: "KS-2026-000007", expireLe: "2026-11-01T12:30:00Z" })),
    ...s,
  };
}

const commande = {
  zone: "goma" as const,
  mode: "livraison" as const,
  telephone: "+243990000000",
  adresse: "TEST_adresse",
  acceptations: { cgv: true },
  totalAttenduCents: 9500,
  empreinte: "0123456789abcdef0123456789abcdef",
  cleIdempotence: "TEST_cle-0001",
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Code promo : récapitulatif", () => {
  it("le code saisi est envoyé nettoyé, la réduction et la part par ligne sont reprises, le taux de commission n'est jamais repris", async () => {
    const deps = faux();
    const r = await lireRecapitulatif(deps, { zone: "goma", mode: "livraison", code: "  promo10 " }, "fr");
    expect(deps.recapitulatif).toHaveBeenCalledWith({ compteId: "TEST_compte", panierId: PANIER, zone: "goma", mode: "livraison", code: "promo10" });
    if (!r.ok) throw new Error("attendu : ok");
    expect(r.recap.reductionCents).toBe(1000);
    expect(r.recap.lignes[0]?.reductionCents).toBe(1000);
    expect(r.recap.totalCents).toBe(9500);
    expect(r.recap.code).toEqual({ valide: true, code: "PROMO10", reductionPct: 10 });
    expect(JSON.stringify(r.recap)).not.toContain("commission");
  });

  it("sans code ou code vide : aucun code envoyé, aucune réduction", async () => {
    const deps = faux({ recapitulatif: vi.fn(async () => ({ recap: recapBrut({ reduction_cents: 0, code: null, total_cents: 10500, lignes: [] }) })) });
    const r = await lireRecapitulatif(deps, { zone: "goma", mode: "livraison", code: "   " }, "fr");
    expect(deps.recapitulatif).toHaveBeenCalledWith(expect.objectContaining({ code: null }));
    if (!r.ok) throw new Error("attendu : ok");
    expect(r.recap.code).toBeNull();
    expect(r.recap.reductionCents).toBe(0);
  });

  it("un code refusé par la base est rendu avec sa raison, un motif inconnu devient « code_inconnu »", async () => {
    for (const [erreur, attendu] of [
      ["code_inactif", "code_inactif"],
      ["code_plafond", "code_plafond"],
      ["code_premier_achat", "code_premier_achat"],
      ["code_un_seul", "code_un_seul"],
      ["code_total_nul", "code_total_nul"],
      ["n_importe_quoi", "code_inconnu"],
    ] as const) {
      const deps = faux({ recapitulatif: vi.fn(async () => ({ recap: recapBrut({ reduction_cents: 0, code: { valide: false, erreur } }) })) });
      const r = await lireRecapitulatif(deps, { code: "X" }, "fr");
      if (!r.ok) throw new Error("attendu : ok");
      expect(r.recap.code).toEqual({ valide: false, erreur: attendu });
    }
  });

  it("un code trop long est refusé avant tout appel", async () => {
    const deps = faux();
    const r = await lireRecapitulatif(deps, { code: "A".repeat(41) }, "fr");
    expect(r).toEqual({ ok: false, erreur: "remise" });
    expect(deps.recapitulatif).not.toHaveBeenCalled();
  });
});

describe("Code promo : création", () => {
  it("le code est transmis à la base avec le total réduit que le client a vu", async () => {
    const deps = faux();
    const r = await creerCommande(deps, { ...commande, code: " promo10" }, "fr");
    expect(r).toEqual({ ok: true, numero: "KS-2026-000007", expireLe: "2026-11-01T12:30:00Z" });
    expect(deps.creerCommande).toHaveBeenCalledWith(expect.objectContaining({ code: "promo10", totalAttenduCents: 9500 }));
  });

  it("sans code : code nul", async () => {
    const deps = faux();
    await creerCommande(deps, commande, "fr");
    expect(deps.creerCommande).toHaveBeenCalledWith(expect.objectContaining({ code: null }));
  });

  it("chaque refus de la base devient son code d'erreur, jamais un succès", async () => {
    for (const [message, attendu] of [
      ["KS_CODE_INCONNU", "code_inconnu"],
      ["KS_CODE_INACTIF", "code_inactif"],
      ["KS_CODE_PLAFOND", "code_plafond"],
      ["KS_CODE_PREMIER_ACHAT", "code_premier_achat"],
      ["KS_CODE_UN_SEUL", "code_un_seul"],
      ["KS_CODE_TOTAL_NUL", "code_total_nul"],
    ] as const) {
      const deps = faux({ creerCommande: vi.fn(async () => ({ erreur: `Erreur : ${message}` })) });
      expect(await creerCommande(deps, { ...commande, code: "X" }, "fr")).toEqual({ ok: false, erreur: attendu });
    }
  });

  it("total changé : le nouveau Récapitulatif est relu avec le même code", async () => {
    const deps = faux({ creerCommande: vi.fn(async () => ({ erreur: "KS_TOTAL_CHANGE" })) });
    const r = await creerCommande(deps, { ...commande, code: "promo10" }, "fr");
    expect(r).toMatchObject({ ok: false, erreur: "total_change" });
    expect(deps.recapitulatif).toHaveBeenCalledWith(expect.objectContaining({ code: "promo10" }));
  });
});
