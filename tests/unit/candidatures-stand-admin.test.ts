// Story 7.11 : candidatures Stand côté Admin. État affiché, refus (droit, entrée, erreurs de la base, invalidation seulement après succès),
// purge à 90 jours (aucun marquage si l'effacement échoue) et route /api/cron/purger-candidatures-stand (CRON_SECRET). Faux accès nommés TEST ; rien de réel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  rpc: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", async () => {
  const reel = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...reel, connection: async () => {} };
});
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({ rpc: etat.rpc, storage: { from: () => ({ remove: etat.remove, list: async () => ({ data: [], error: null }) }) } }),
}));

import { POST } from "@/app/api/cron/purger-candidatures-stand/route";
import { etatCandidature, fermerStandSurPlace, refuserCandidatureStand, type DependancesFermetureStand, type DependancesRefusCandidature } from "@/modules/evenements/candidatures-admin";
import { purgerCandidaturesStand, type DependancesPurgeCandidatures } from "@/modules/evenements/candidatures-purge";

const CAND = "00000000-0000-4000-8000-0000000000b1";
const AUTEUR = { type: "compte", id: "00000000-0000-4000-8000-0000000000e9", role: "admin" } as never;
const demain = new Date(Date.now() + 86_400_000).toISOString();
const hier = new Date(Date.now() - 86_400_000).toISOString();

describe("etatCandidature", () => {
  const maintenant = Date.now();
  it.each([
    [{ statut: "refusee", expireLe: demain, commandeStatut: "payee" }, "refusee"],
    [{ statut: "validee", expireLe: hier, commandeStatut: "payee" }, "payee"],
    [{ statut: "validee", expireLe: hier, commandeStatut: "offerte" }, "payee"],
    [{ statut: "validee", expireLe: demain, commandeStatut: null }, "acceptee"],
    [{ statut: "validee", expireLe: demain, commandeStatut: "en_attente" }, "acceptee"],
    [{ statut: "validee", expireLe: hier, commandeStatut: "en_attente" }, "expiree"],
    [{ statut: "validee", expireLe: hier, commandeStatut: null }, "expiree"],
    [{ statut: "validee", expireLe: hier, commandeStatut: "payee", fermeeLe: hier }, "fermee"],
    [{ statut: "validee", expireLe: hier, commandeStatut: "payee", fermeeLe: null }, "payee"],
  ])("%j → %s", (entree, attendu) => {
    expect(etatCandidature(entree, maintenant)).toBe(attendu);
  });
});

describe("fermerStandSurPlace (sans remboursement)", () => {
  const deps = (fermer?: DependancesFermetureStand["fermer"], droit = true) => {
    const invalider = vi.fn(async () => {});
    const d: DependancesFermetureStand = {
      exigerDroit: async () => {
        if (!droit) throw new Error("KS_DROIT_REFUSE");
        return { auteur: AUTEUR };
      },
      fermer: fermer ?? (async () => ({ erreur: null })),
      invalider,
    };
    return { d, invalider };
  };

  it("sans droit : refusé, la base n'est pas appelée", async () => {
    const fermer = vi.fn(async () => ({ erreur: null }));
    const { d } = deps(fermer, false);
    expect(await fermerStandSurPlace(d, { candidatureId: CAND, motif: "" })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(fermer).not.toHaveBeenCalled();
  });
  it("entrée invalide : identifiant mal formé, motif non texte ou trop long", async () => {
    const { d } = deps();
    expect(await fermerStandSurPlace(d, { candidatureId: "x", motif: "" })).toEqual({ ok: false, erreur: "entree_invalide" });
    expect(await fermerStandSurPlace(d, { candidatureId: CAND, motif: 12 })).toEqual({ ok: false, erreur: "entree_invalide" });
    expect(await fermerStandSurPlace(d, { candidatureId: CAND, motif: "x".repeat(501) })).toEqual({ ok: false, erreur: "entree_invalide" });
  });
  it("succès : motif nettoyé, aucun montant, cache vidé une seule fois", async () => {
    const fermer = vi.fn(async () => ({ erreur: null }));
    const { d, invalider } = deps(fermer);
    expect(await fermerStandSurPlace(d, { candidatureId: CAND, motif: "  Copies de figurines  " })).toEqual({ ok: true });
    expect(fermer).toHaveBeenCalledWith({ auteur: AUTEUR, candidatureId: CAND, motif: "Copies de figurines" });
    expect(invalider).toHaveBeenCalledTimes(1);
    await fermerStandSurPlace(d, { candidatureId: CAND, motif: "   " });
    expect(fermer).toHaveBeenLastCalledWith({ auteur: AUTEUR, candidatureId: CAND, motif: null });
  });
  it.each([
    ["KS_CANDIDATURE_INTROUVABLE", "introuvable"],
    ["KS_CANDIDATURE_REFUSEE", "deja_refusee"],
    ["KS_STAND_DEJA_FERME", "deja_ferme"],
    ["KS_STAND_NON_PAYE", "non_paye"],
    ["KS_EVENEMENT_PAS_COMMENCE", "evenement_pas_commence"],
    ["KS_ANNULATION_IMPOSSIBLE", "annulation_impossible"],
    ["KS_MOTIF_INVALIDE", "entree_invalide"],
    ["KS_DROIT_REFUSE", "non_autorise"],
    ["KS_AUTRE", "generique"],
  ])("erreur de la base %s → %s, cache non vidé", async (message, attendu) => {
    const { d, invalider } = deps(async () => ({ erreur: `P0001 ${message}` }));
    expect(await fermerStandSurPlace(d, { candidatureId: CAND, motif: "" })).toEqual({ ok: false, erreur: attendu });
    expect(invalider).not.toHaveBeenCalled();
  });
  it("exception inattendue : erreur générique, cache non vidé", async () => {
    const { d, invalider } = deps(async () => {
      throw new Error("réseau");
    });
    expect(await fermerStandSurPlace(d, { candidatureId: CAND, motif: "" })).toEqual({ ok: false, erreur: "generique" });
    expect(invalider).not.toHaveBeenCalled();
  });
});

describe("refuserCandidatureStand", () => {
  const deps = (refuser?: DependancesRefusCandidature["refuser"], droit = true) => {
    const invalider = vi.fn(async () => {});
    const d: DependancesRefusCandidature = {
      exigerDroit: async () => {
        if (!droit) throw new Error("KS_DROIT_REFUSE");
        return { auteur: AUTEUR };
      },
      refuser: refuser ?? (async () => ({ erreur: null, montantCents: 0 })),
      invalider,
    };
    return { d, invalider };
  };

  it("sans droit : refusé, la base n'est pas appelée", async () => {
    const refuser = vi.fn(async () => ({ erreur: null, montantCents: 0 }));
    const { d } = deps(refuser, false);
    expect(await refuserCandidatureStand(d, { candidatureId: CAND, motif: "" })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(refuser).not.toHaveBeenCalled();
  });
  it("entrée invalide : identifiant mal formé, motif non texte ou trop long", async () => {
    const { d } = deps();
    expect(await refuserCandidatureStand(d, { candidatureId: "x", motif: "" })).toEqual({ ok: false, erreur: "entree_invalide" });
    expect(await refuserCandidatureStand(d, { candidatureId: CAND, motif: 12 })).toEqual({ ok: false, erreur: "entree_invalide" });
    expect(await refuserCandidatureStand(d, { candidatureId: CAND, motif: "x".repeat(501) })).toEqual({ ok: false, erreur: "entree_invalide" });
  });
  it("succès : motif nettoyé (vide → null), montant rendu, cache vidé une seule fois", async () => {
    const refuser = vi.fn(async () => ({ erreur: null, montantCents: 3200 }));
    const { d, invalider } = deps(refuser);
    expect(await refuserCandidatureStand(d, { candidatureId: CAND, motif: "  Contrefaçon  " })).toEqual({ ok: true, montantCents: 3200 });
    expect(refuser).toHaveBeenCalledWith({ auteur: AUTEUR, candidatureId: CAND, motif: "Contrefaçon" });
    expect(invalider).toHaveBeenCalledTimes(1);
    await refuserCandidatureStand(d, { candidatureId: CAND, motif: "   " });
    expect(refuser).toHaveBeenLastCalledWith({ auteur: AUTEUR, candidatureId: CAND, motif: null });
  });
  it.each([
    ["KS_CANDIDATURE_INTROUVABLE", "introuvable"],
    ["KS_CANDIDATURE_REFUSEE", "deja_refusee"],
    ["KS_ANNULATION_IMPOSSIBLE", "annulation_impossible"],
    ["KS_REGLAGE_MANQUANT", "reglage_manquant"],
    ["KS_DROIT_REFUSE", "non_autorise"],
    ["autre chose", "generique"],
  ])("erreur de la base %s → %s, cache non vidé", async (code, attendu) => {
    const { d, invalider } = deps(async () => ({ erreur: `ERROR: ${code}`, montantCents: 0 }));
    expect(await refuserCandidatureStand(d, { candidatureId: CAND, motif: "" })).toEqual({ ok: false, erreur: attendu });
    expect(invalider).not.toHaveBeenCalled();
  });
  it("exception inattendue : erreur générique", async () => {
    const { d } = deps(async () => {
      throw new Error("TEST_panne");
    });
    expect(await refuserCandidatureStand(d, { candidatureId: CAND, motif: "" })).toEqual({ ok: false, erreur: "generique" });
  });
});

describe("purgerCandidaturesStand", () => {
  const fabrique = (surcharge: Partial<DependancesPurgeCandidatures> = {}) => {
    const effacerObjets = vi.fn(async () => ({ erreur: null as string | null }));
    const marquerPurgee = vi.fn(async () => ({ erreur: null as string | null }));
    const d: DependancesPurgeCandidatures = {
      aPurger: async () => ({ erreur: null, candidatures: [{ id: "TEST_k1", photos: ["a/1.jpg", "a/2.png", "a/3.webp"] }] }),
      effacerObjets,
      marquerPurgee,
      listerEnvois: async () => ({ erreur: null, objets: [] }),
      ...surcharge,
    };
    return { d, effacerObjets, marquerPurgee };
  };

  it("efface les objets puis marque la candidature purgée", async () => {
    const { d, effacerObjets, marquerPurgee } = fabrique();
    expect(await purgerCandidaturesStand(d)).toEqual({ ok: true, purgees: 1, echecs: 0, envoisEfface: 0 });
    expect(effacerObjets).toHaveBeenCalledWith(["a/1.jpg", "a/2.png", "a/3.webp"]);
    expect(marquerPurgee).toHaveBeenCalledWith("TEST_k1");
  });
  it("effacement en échec : rien n'est marqué, la candidature reviendra", async () => {
    const { d, marquerPurgee } = fabrique({ effacerObjets: async () => ({ erreur: "TEST_panne" }) });
    expect(await purgerCandidaturesStand(d)).toEqual({ ok: false, purgees: 0, echecs: 1, envoisEfface: 0 });
    expect(marquerPurgee).not.toHaveBeenCalled();
  });
  it("marquage en échec ou exception : compté comme échec, les suivantes continuent", async () => {
    const { d } = fabrique({
      aPurger: async () => ({ erreur: null, candidatures: [{ id: "TEST_k1", photos: ["a/1.jpg"] }, { id: "TEST_k2", photos: [] }] }),
      marquerPurgee: vi.fn().mockRejectedValueOnce(new Error("TEST_panne")).mockResolvedValueOnce({ erreur: null }),
    });
    expect(await purgerCandidaturesStand(d)).toEqual({ ok: false, purgees: 1, echecs: 1, envoisEfface: 0 });
  });
  it("lecture du lot impossible : échec, rien d'effacé", async () => {
    const { d, effacerObjets } = fabrique({ aPurger: async () => ({ erreur: "TEST_panne", candidatures: [] }) });
    expect((await purgerCandidaturesStand(d)).ok).toBe(false);
    expect(effacerObjets).not.toHaveBeenCalled();
  });
  it("envois non finalisés : seuls ceux de plus de 24 h sont effacés", async () => {
    const maintenant = Date.parse("2026-11-12T12:00:00Z");
    const { d, effacerObjets } = fabrique({
      aPurger: async () => ({ erreur: null, candidatures: [] }),
      listerEnvois: async () => ({
        erreur: null,
        objets: [
          { objet: "envois-candidatures/TEST_vieux.jpg", creeLe: "2026-11-11T11:00:00Z" },
          { objet: "envois-candidatures/TEST_recent.jpg", creeLe: "2026-11-12T11:00:00Z" },
          { objet: "envois-candidatures/TEST_sans_date.jpg", creeLe: null },
        ],
      }),
    });
    expect(await purgerCandidaturesStand(d, 50, maintenant)).toEqual({ ok: true, purgees: 0, echecs: 0, envoisEfface: 1 });
    expect(effacerObjets).toHaveBeenCalledWith(["envois-candidatures/TEST_vieux.jpg"]);
  });
  it("aucune candidature à purger : succès à zéro", async () => {
    const { d } = fabrique({ aPurger: async () => ({ erreur: null, candidatures: [] }) });
    expect(await purgerCandidaturesStand(d)).toEqual({ ok: true, purgees: 0, echecs: 0, envoisEfface: 0 });
  });
});

describe("POST /api/cron/purger-candidatures-stand", () => {
  const requete = (autorisation?: string) =>
    new Request("http://localhost/api/cron/purger-candidatures-stand", { method: "POST", headers: autorisation ? { authorization: autorisation } : {} });
  beforeEach(() => {
    process.env.CRON_SECRET = "TEST_secret";
    etat.rpc.mockReset();
    etat.remove.mockReset();
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("sans le secret : 401, la base n'est pas lue", async () => {
    expect((await POST(requete())).status).toBe(401);
    expect((await POST(requete("Bearer mauvais"))).status).toBe(401);
    expect(etat.rpc).not.toHaveBeenCalled();
  });
  it("avec le secret : objets effacés puis candidature marquée", async () => {
    etat.rpc.mockImplementation(async (nom: string) => (nom === "candidatures_stand_a_purger" ? { data: [{ candidature_id: "TEST_k1", photos: ["a/1.jpg"] }], error: null } : { data: null, error: null }));
    etat.remove.mockResolvedValue({ error: null });
    const r = await POST(requete("Bearer TEST_secret"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, purgees: 1, echecs: 0, envoisEfface: 0 });
    expect(etat.rpc).toHaveBeenCalledWith("marquer_candidature_stand_purgee", { p_candidature: "TEST_k1" });
  });
  it("effacement en échec : 500 et aucun marquage", async () => {
    etat.rpc.mockResolvedValue({ data: [{ candidature_id: "TEST_k1", photos: ["a/1.jpg"] }], error: null });
    etat.remove.mockResolvedValue({ error: { message: "TEST_panne" } });
    expect((await POST(requete("Bearer TEST_secret"))).status).toBe(500);
    expect(etat.rpc).not.toHaveBeenCalledWith("marquer_candidature_stand_purgee", expect.anything());
  });
});
