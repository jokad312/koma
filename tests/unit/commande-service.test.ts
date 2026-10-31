import { describe, expect, it, vi } from "vitest";
import { construireAuteur } from "@/lib/auth/auteur";
import { VERSION_LICENCE_KIT } from "@/modules/commande/schemas";
import { obtenirKitGratuit } from "@/modules/commande/service";
import type { DependancesCommande } from "@/modules/commande/types";

const PRODUIT = "00000000-0000-4000-8000-0000000000aa";
const CLE = "TEST_cle-0001";
const entree = { produitId: PRODUIT, licenceAcceptee: true as const, cleIdempotence: CLE };

function faux(surcharge: Partial<DependancesCommande> = {}): DependancesCommande {
  return {
    exigerCompte: vi.fn(async () => ({ compteId: "TEST_compte", auteur: construireAuteur("TEST_compte") })),
    offrirCommande: vi.fn(async () => ({ erreur: null, numero: "KS-2026-000001" })),
    ...surcharge,
  };
}

const refus = (code: string) => async () => {
  throw Object.assign(new Error(code), { code });
};

describe("obtenirKitGratuit", () => {
  it("renvoie le numéro de la Commande après la réponse réelle de la base", async () => {
    const deps = faux();
    await expect(obtenirKitGratuit(deps, entree)).resolves.toEqual({ ok: true, numero: "KS-2026-000001" });
  });

  it("envoie à la base l'auteur de la session, la Licence de kit avec sa version et la clé du formulaire", async () => {
    const deps = faux();
    await obtenirKitGratuit(deps, entree);
    expect(deps.offrirCommande).toHaveBeenCalledWith({
      auteur: { type: "compte", id: "TEST_compte", role: null },
      produitId: PRODUIT,
      acceptations: [{ objet: "licence_kit", version: VERSION_LICENCE_KIT }],
      cleIdempotence: CLE,
    });
  });

  it("refuse sans la case de la Licence, sans toucher à la base", async () => {
    const deps = faux();
    const r = await obtenirKitGratuit(deps, { ...entree, licenceAcceptee: false as unknown as true });
    expect(r).toEqual({ ok: false, erreur: "licence" });
    expect(deps.exigerCompte).not.toHaveBeenCalled();
    expect(deps.offrirCommande).not.toHaveBeenCalled();
  });

  it("refuse un identifiant de Kit ou une clé invalides", async () => {
    const deps = faux();
    await expect(obtenirKitGratuit(deps, { ...entree, produitId: "pas-un-uuid" })).resolves.toEqual({ ok: false, erreur: "invalide" });
    await expect(obtenirKitGratuit(deps, { ...entree, cleIdempotence: "court" })).resolves.toEqual({ ok: false, erreur: "invalide" });
    expect(deps.offrirCommande).not.toHaveBeenCalled();
  });

  it("refuse un visiteur non connecté et un Compte incomplet, sans toucher à la base", async () => {
    const non = faux({ exigerCompte: refus("KS_NON_CONNECTE") });
    await expect(obtenirKitGratuit(non, entree)).resolves.toEqual({ ok: false, erreur: "non_connecte" });
    const incomplet = faux({ exigerCompte: refus("KS_COMPTE_INCOMPLET") });
    await expect(obtenirKitGratuit(incomplet, entree)).resolves.toEqual({ ok: false, erreur: "compte_incomplet" });
    expect(non.offrirCommande).not.toHaveBeenCalled();
    expect(incomplet.offrirCommande).not.toHaveBeenCalled();
  });

  it("une vérification impossible du Compte est une erreur, jamais un succès", async () => {
    const deps = faux({ exigerCompte: refus("KS_VERIFICATION_IMPOSSIBLE") });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(obtenirKitGratuit(deps, entree)).resolves.toEqual({ ok: false, erreur: "erreur" });
  });

  it.each([
    ["KS_KIT_DEJA_POSSEDE", "deja_possede"],
    ["KS_ACCEPTATION_MANQUANTE", "licence"],
    ["KS_KIT_NON_GRATUIT", "indisponible"],
    ["KS_PRODUIT_INTROUVABLE", "indisponible"],
    ["KS_COMPTE_INCOMPLET", "compte_incomplet"],
  ])("traduit le refus %s de la base en %s", async (codeBase, attendu) => {
    const deps = faux({ offrirCommande: vi.fn(async () => ({ erreur: codeBase })) });
    await expect(obtenirKitGratuit(deps, entree)).resolves.toEqual({ ok: false, erreur: attendu });
  });

  it("une erreur inconnue de la base ou une exception ne devient jamais un succès", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const inconnue = faux({ offrirCommande: vi.fn(async () => ({ erreur: "autre chose" })) });
    await expect(obtenirKitGratuit(inconnue, entree)).resolves.toEqual({ ok: false, erreur: "erreur" });
    const exception = faux({ offrirCommande: vi.fn(async () => { throw new Error("réseau"); }) });
    await expect(obtenirKitGratuit(exception, entree)).resolves.toEqual({ ok: false, erreur: "erreur" });
    const sansNumero = faux({ offrirCommande: vi.fn(async () => ({ erreur: null })) });
    await expect(obtenirKitGratuit(sansNumero, entree)).resolves.toEqual({ ok: false, erreur: "erreur" });
  });

  it("ne journalise ni identifiant de Compte ni message de la base", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = faux({ offrirCommande: vi.fn(async () => ({ erreur: "détail secret TEST_compte" })) });
    await obtenirKitGratuit(deps, entree);
    const texte = spy.mock.calls.flat().join(" ");
    expect(texte).not.toContain("TEST_compte");
    expect(texte).not.toContain("secret");
  });
});
