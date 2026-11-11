import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { annulerEnvoiCandidature, demanderEnvoiCandidature, finaliserCandidature } from "@/modules/evenements/candidature";
import { descriptionValable, VERSION_ENGAGEMENT_STAND } from "@/modules/evenements/candidature-types";
import type { DependancesCandidature } from "@/modules/evenements/candidature-types";

vi.mock("server-only", () => ({}));

const COMPTE = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";
const EVENEMENT = "33333333-3333-4333-8333-333333333333";
const TYPE = "44444444-4444-4444-8444-444444444444";
const DESCRIPTION = "TEST_ Bijoux et accessoires faits main, trois gammes de prix.";

let png: Uint8Array;
beforeAll(async () => {
  png = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#ffffff" } }).png().toBuffer());
});

const objetEnvoi = (compte: string, n: number) => `envois-candidatures/${compte}.0000000${n}-0000-4000-8000-000000000000.png`;
const OBJETS = [1, 2, 3].map((n) => objetEnvoi(COMPTE, n));

// Dépendances de test (TEST_) : un stockage en mémoire et une base qui répond ce qu'on lui demande.
function faux(sur: Partial<DependancesCandidature> = {}) {
  const stock = new Map<string, Uint8Array>(OBJETS.map((o) => [o, png]));
  const deps: DependancesCandidature = {
    compte: async () => ({ compteId: COMPTE, auteur: { type: "compte", id: COMPTE, role: null } }),
    consommerEssai: async () => ({ autorise: true }),
    verifierPossible: async () => ({ obstacle: null }),
    signerEnvoi: async () => ({ jeton: "TEST_jeton" }),
    lireObjet: async (o) => (stock.has(o) ? { octets: stock.get(o)! } : { erreur: "absent" }),
    ecrireObjet: async ({ objet, octets }) => {
      stock.set(objet, octets);
      return { erreur: null };
    },
    supprimerObjet: async (o) => {
      stock.delete(o);
      return { erreur: null };
    },
    deposer: vi.fn(async () => ({ expireLe: "2026-12-01T12:00:00Z" })),
    ...sur,
  };
  return { deps, stock };
}

const entree = (s: Record<string, unknown> = {}) => ({ evenementId: EVENEMENT, typePassId: TYPE, objets: OBJETS, description: DESCRIPTION, instagram: "@test_exposant", engagement: true, ...s });

describe("demanderEnvoiCandidature", () => {
  const fichiers = [1, 2, 3].map(() => ({ type: "image/png", taille: 1000 }));

  it("autorise trois envois, chemins choisis par le serveur au nom du Compte", async () => {
    const { deps } = faux();
    const r = await demanderEnvoiCandidature(deps, { evenementId: EVENEMENT, typePassId: TYPE, fichiers });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.objets).toHaveLength(3);
      for (const o of r.objets) expect(o.objet.startsWith(`envois-candidatures/${COMPTE}.`)).toBe(true);
    }
  });

  it("un obstacle connu est annoncé avant tout envoi, sans consommer la limite d'envois", async () => {
    const consommerEssai = vi.fn(async () => ({ autorise: true }));
    const signerEnvoi = vi.fn(async () => ({ jeton: "TEST_jeton" }));
    for (const [obstacle, erreur] of [["KS_CANDIDATURE_REFUSEE", "candidature_refusee"], ["KS_CANDIDATURE_EXISTANTE", "deja_candidat"], ["KS_COMPLET", "complet"], ["KS_VENTE_FERMEE", "vente_fermee"]] as const) {
      const { deps } = faux({ verifierPossible: async () => ({ obstacle }), consommerEssai, signerEnvoi });
      expect(await demanderEnvoiCandidature(deps, { evenementId: EVENEMENT, typePassId: TYPE, fichiers })).toEqual({ ok: false, erreur });
    }
    expect(consommerEssai).not.toHaveBeenCalled();
    expect(signerEnvoi).not.toHaveBeenCalled();
  });

  it("pré-contrôle en panne : erreur générique, rien n'est signé", async () => {
    const signerEnvoi = vi.fn(async () => ({ jeton: "TEST_jeton" }));
    const { deps } = faux({ verifierPossible: async () => ({ erreur: "TEST_panne" }), signerEnvoi });
    expect(await demanderEnvoiCandidature(deps, { evenementId: EVENEMENT, typePassId: TYPE, fichiers })).toEqual({ ok: false, erreur: "generique" });
    expect(signerEnvoi).not.toHaveBeenCalled();
  });

  it("refuse un format hors JPEG, PNG, WebP, une photo trop lourde et un nombre de photos différent de trois", async () => {
    const { deps } = faux();
    expect(await demanderEnvoiCandidature(deps, { evenementId: EVENEMENT, typePassId: TYPE, fichiers: [{ type: "image/gif", taille: 10 }, ...fichiers.slice(1)] })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await demanderEnvoiCandidature(deps, { evenementId: EVENEMENT, typePassId: TYPE, fichiers: [{ type: "image/png", taille: 16 * 1024 * 1024 }, ...fichiers.slice(1)] })).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(await demanderEnvoiCandidature(deps, { evenementId: EVENEMENT, typePassId: TYPE, fichiers: fichiers.slice(0, 2) })).toEqual({ ok: false, erreur: "invalide" });
  });

  it("refuse sans session, avec un Compte incomplet et au-delà de la limite horaire", async () => {
    expect(await demanderEnvoiCandidature(faux({ compte: async () => ({ erreur: "non_connecte" }) }).deps, { evenementId: EVENEMENT, typePassId: TYPE, fichiers })).toEqual({ ok: false, erreur: "non_connecte" });
    expect(await demanderEnvoiCandidature(faux({ compte: async () => ({ erreur: "compte_incomplet" }) }).deps, { evenementId: EVENEMENT, typePassId: TYPE, fichiers })).toEqual({ ok: false, erreur: "compte_incomplet" });
    expect(await demanderEnvoiCandidature(faux({ consommerEssai: async () => ({ autorise: false }) }).deps, { evenementId: EVENEMENT, typePassId: TYPE, fichiers })).toEqual({ ok: false, erreur: "trop_d_envois" });
  });
});

describe("finaliserCandidature", () => {
  it("succès : trois copies nettoyées dans le dossier de la candidature, originaux effacés, dépôt avec la version de l'engagement", async () => {
    const { deps, stock } = faux();
    const r = await finaliserCandidature(deps, entree());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const appel = vi.mocked(deps.deposer).mock.calls[0][0];
    expect(appel.photos).toHaveLength(3);
    expect(appel.photos.every((p, i) => p === `${EVENEMENT}/${r.candidatureId}/${i + 1}.png`)).toBe(true);
    expect(appel.versionEngagement).toBe(VERSION_ENGAGEMENT_STAND);
    expect(appel.id).toBe(r.candidatureId);
    expect(r.expireLe).toBe("2026-12-01T12:00:00Z");
    for (const o of OBJETS) expect(stock.has(o)).toBe(false);
    for (const p of appel.photos) expect(stock.has(p)).toBe(true);
  });

  it("l'engagement non coché est refusé avant toute lecture ou écriture", async () => {
    const { deps } = faux({ lireObjet: vi.fn(async () => ({ erreur: "jamais" })) });
    expect(await finaliserCandidature(deps, entree({ engagement: false }))).toEqual({ ok: false, erreur: "engagement_manquant" });
    expect(deps.lireObjet).not.toHaveBeenCalled();
    expect(deps.deposer).not.toHaveBeenCalled();
  });

  it("description ou Instagram invalides : refusés, originaux effacés", async () => {
    const a = faux();
    expect(await finaliserCandidature(a.deps, entree({ description: "trop court" }))).toEqual({ ok: false, erreur: "description_invalide" });
    expect(a.stock.size).toBe(0);
    const b = faux();
    expect(await finaliserCandidature(b.deps, entree({ instagram: "pas un pseudo !" }))).toEqual({ ok: false, erreur: "instagram_invalide" });
    expect(b.stock.size).toBe(0);
    const c = faux();
    expect(await finaliserCandidature(c.deps, entree({ instagram: "https://instagram.com/test.exposant" }))).toMatchObject({ ok: true });
  });

  it("un fichier qui n'est pas une image est refusé et tout est effacé", async () => {
    const { deps, stock } = faux();
    stock.set(OBJETS[1], new Uint8Array([1, 2, 3, 4]));
    expect(await finaliserCandidature(deps, entree())).toEqual({ ok: false, erreur: "format_invalide" });
    expect(stock.size).toBe(0);
    expect(deps.deposer).not.toHaveBeenCalled();
  });

  it("un envoi autorisé pour un autre Compte n'est ni lu ni effacé", async () => {
    const autres = [1, 2, 3].map((n) => objetEnvoi(AUTRE, n));
    const { deps, stock } = faux({ lireObjet: vi.fn(async () => ({ erreur: "jamais" })) });
    for (const o of autres) stock.set(o, png);
    expect(await finaliserCandidature(deps, entree({ objets: autres }))).toEqual({ ok: false, erreur: "format_invalide" });
    expect(deps.lireObjet).not.toHaveBeenCalled();
    for (const o of autres) expect(stock.has(o)).toBe(true);
  });

  it.each([
    ["KS_COMPLET", "complet"],
    ["KS_CANDIDATURE_EXISTANTE", "deja_candidat"],
    ["KS_CANDIDATURE_REFUSEE", "candidature_refusee"],
    ["KS_VENTE_FERMEE", "vente_fermee"],
    ["KS_CANDIDATURE_DESCRIPTION", "description_invalide"],
    ["KS_CANDIDATURE_INSTAGRAM", "instagram_invalide"],
    ["KS_CANDIDATURE_PHOTOS", "format_invalide"],
    ["KS_COMPTE_INCOMPLET", "compte_incomplet"],
    ["KS_TYPE_PASS_INTROUVABLE", "type_introuvable"],
    ["KS_REGLAGE_MANQUANT", "reglage_manquant"],
    ["boom inconnu", "generique"],
  ])("refus de la base %s : code %s, rien ne reste dans le stockage", async (message, code) => {
    const { deps, stock } = faux({ deposer: async () => ({ erreur: message }) });
    expect(await finaliserCandidature(deps, entree())).toEqual({ ok: false, erreur: code });
    expect(stock.size).toBe(0);
  });

  it("une exception en cours de route efface ce qui a été écrit", async () => {
    const { deps, stock } = faux({
      deposer: async () => {
        throw new Error("TEST_panne");
      },
    });
    expect(await finaliserCandidature(deps, entree())).toEqual({ ok: false, erreur: "generique" });
    expect(stock.size).toBe(0);
  });
});

describe("annulerEnvoiCandidature", () => {
  it("efface les envois du Compte et refuse ceux d'un autre", async () => {
    const { deps, stock } = faux();
    expect(await annulerEnvoiCandidature(deps, { objets: OBJETS })).toEqual({ ok: true });
    expect(stock.size).toBe(0);
    const b = faux();
    expect(await annulerEnvoiCandidature(b.deps, { objets: [objetEnvoi(AUTRE, 1)] })).toEqual({ ok: false, erreur: "invalide" });
  });
});

describe("descriptionValable", () => {
  it("accepte les émojis composés (U+200D) et les retours à la ligne, refuse < >, les caractères invisibles et les longueurs hors bornes", () => {
    const base = "TEST_ Bijoux et accessoires faits main";
    expect(descriptionValable(`${base} \u{1F469}\u200D\u{1F3A4} cosplay\nDeuxième ligne`)).toBe(true);
    expect(descriptionValable(`${base} <b>gras</b>`)).toBe(false);
    expect(descriptionValable(`${base} caché\u200B ici`)).toBe(false);
    expect(descriptionValable(`${base} inversé\u202E ici`)).toBe(false);
    expect(descriptionValable("trop court")).toBe(false);
    expect(descriptionValable("x".repeat(1001))).toBe(false);
  });
});
