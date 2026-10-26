import { beforeEach, describe, expect, it, vi } from "vitest";
import { creerTestDependancesCatalogue, TEST_ADMIN_ID } from "../doubles/TEST_dependances-catalogue";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({
  courant: null as unknown,
  rpc: vi.fn(),
  supprime: vi.fn(),
  tag: vi.fn(),
}));
vi.mock("@/modules/catalogue/dependances", () => ({
  dependances: () => {
    if (faux.courant instanceof Error) throw faux.courant;
    return faux.courant;
  },
}));

import { modifierAltPhoto as actionAlt, supprimerPhoto as actionSupprimer } from "@/modules/catalogue/actions";
import { modifierAltPhoto, supprimerPhoto } from "@/modules/catalogue/service";

const PHOTO = "00000000-0000-4000-8000-0000000000dd";
const AUTEUR = { type: "compte", id: TEST_ADMIN_ID, role: "admin" };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("supprimerPhoto (service)", () => {
  it("la base d'abord, puis le fichier public, puis le cache ; l'auteur est transmis", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await supprimerPhoto(deps, { photoId: PHOTO })).toEqual({ ok: true });
    expect(appels.ordre).toEqual(["droit", "supprimerPhoto", "supprimer:produits-public", "invalidation"]);
    expect(appels.suppressionsPhoto).toEqual([{ auteur: AUTEUR, photoId: PHOTO }]);
    expect(appels.suppressions).toEqual([{ bucket: "produits-public", objets: ["TEST_produit/TEST_fichier.jpg"] }]);
    expect(appels.droits).toEqual(["produits.modifier"]);
  });

  it("échec d'effacement du fichier : journalisé, la suppression en base est conservée (succès)", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ erreurSuppression: "TEST_storage_en_panne" });
    expect(await supprimerPhoto(deps, { photoId: PHOTO })).toEqual({ ok: true });
    expect(appels.suppressionsPhoto).toHaveLength(1);
    expect(appels.invalidations).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("nettoyage produits-public"));
  });

  it("l'effacement du fichier qui lève n'annule rien non plus", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    vi.mocked(deps.supprimerObjets).mockRejectedValueOnce(new Error("TEST_coupure"));
    expect(await supprimerPhoto(deps, { photoId: PHOTO })).toEqual({ ok: true });
    expect(appels.invalidations).toBe(1);
  });

  it("dernière photo d'un produit publié : refusée, aucun fichier effacé, cache intact", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ erreurSupprimerPhoto: "KS_PUBLICATION_INCOMPLETE" });
    expect(await supprimerPhoto(deps, { photoId: PHOTO })).toEqual({ ok: false, erreur: "derniere_photo_publiee" });
    expect(appels.suppressions).toEqual([]);
    expect(appels.invalidations).toBe(0);
  });

  it("photo inconnue, droit refusé, identifiant invalide, panne", async () => {
    expect(await supprimerPhoto(creerTestDependancesCatalogue({ erreurSupprimerPhoto: "KS_PHOTO_INTROUVABLE" }).deps, { photoId: PHOTO })).toEqual({ ok: false, erreur: "photo_introuvable" });
    const refus = creerTestDependancesCatalogue({ droit: "KS_DROIT_REFUSE" });
    expect(await supprimerPhoto(refus.deps, { photoId: PHOTO })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(refus.appels.suppressionsPhoto).toEqual([]);
    const sans = creerTestDependancesCatalogue();
    expect(await supprimerPhoto(sans.deps, { photoId: "x" })).toEqual({ ok: false, erreur: "photo_introuvable" });
    expect(sans.appels.suppressionsPhoto).toEqual([]);
    expect(await supprimerPhoto(creerTestDependancesCatalogue({ erreurSupprimerPhoto: "TEST_autre" }).deps, { photoId: PHOTO })).toEqual({ ok: false, erreur: "generique" });
  });

  it("base réussie mais fichier non renvoyé : anomalie journalisée, cache invalidé, succès", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    vi.mocked(deps.supprimerPhoto).mockResolvedValueOnce({ erreur: null, fichier: null });
    expect(await supprimerPhoto(deps, { photoId: PHOTO })).toEqual({ ok: true });
    expect(appels.suppressions).toEqual([]);
    expect(appels.invalidations).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("fichier non renvoyé"));
  });

  it("cache en échec : la suppression reste un succès", async () => {
    const { deps } = creerTestDependancesCatalogue({ invalidationEnEchec: true });
    expect(await supprimerPhoto(deps, { photoId: PHOTO })).toEqual({ ok: true });
  });
});

describe("modifierAltPhoto (service)", () => {
  it("textes rognés, écriture avec l'auteur, cache invalidé après la réponse de la base", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await modifierAltPhoto(deps, { photoId: PHOTO, altFr: "  Face  ", altEn: "Front" })).toEqual({ ok: true });
    expect(appels.ordre).toEqual(["droit", "alt", "invalidation"]);
    expect(appels.alts).toEqual([{ auteur: AUTEUR, photoId: PHOTO, altFr: "Face", altEn: "Front" }]);
  });

  it.each([
    ["français vide", "  ", "Front"],
    ["anglais vide", "Face", ""],
    ["201 caractères", "x".repeat(201), "Front"],
  ])("%s : alt_invalide, rien d'écrit", async (_nom, altFr, altEn) => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await modifierAltPhoto(deps, { photoId: PHOTO, altFr, altEn })).toEqual({ ok: false, erreur: "alt_invalide" });
    expect(appels.alts).toEqual([]);
    expect(appels.invalidations).toBe(0);
  });

  it("200 caractères acceptés", async () => {
    const { deps } = creerTestDependancesCatalogue();
    expect((await modifierAltPhoto(deps, { photoId: PHOTO, altFr: "x".repeat(200), altEn: "y" })).ok).toBe(true);
  });

  it("refus de la base, droit refusé, identifiant invalide", async () => {
    const entree = { photoId: PHOTO, altFr: "a", altEn: "b" };
    expect(await modifierAltPhoto(creerTestDependancesCatalogue({ erreurAlt: "KS_PHOTO_INTROUVABLE" }).deps, entree)).toEqual({ ok: false, erreur: "photo_introuvable" });
    expect(await modifierAltPhoto(creerTestDependancesCatalogue({ erreurAlt: "KS_ALT_INVALIDE" }).deps, entree)).toEqual({ ok: false, erreur: "alt_invalide" });
    expect(await modifierAltPhoto(creerTestDependancesCatalogue({ droit: "KS_DROIT_REFUSE" }).deps, entree)).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await modifierAltPhoto(creerTestDependancesCatalogue().deps, { ...entree, photoId: "x" })).toEqual({ ok: false, erreur: "photo_introuvable" });
  });
});

describe("Server Actions de suppression et de texte alternatif", () => {
  it("succès rendu seulement après la réponse réelle", async () => {
    faux.courant = creerTestDependancesCatalogue().deps;
    expect(await actionSupprimer({ photoId: PHOTO })).toEqual({ statut: "succes" });
    expect(await actionAlt({ photoId: PHOTO, altFr: "a", altEn: "b" })).toEqual({ statut: "succes" });
  });

  it("refus, droit manquant et exception : jamais un succès", async () => {
    faux.courant = creerTestDependancesCatalogue({ erreurSupprimerPhoto: "KS_PUBLICATION_INCOMPLETE" }).deps;
    expect(await actionSupprimer({ photoId: PHOTO })).toMatchObject({ statut: "erreur", erreur: "derniere_photo_publiee" });
    faux.courant = creerTestDependancesCatalogue({ droit: "KS_DROIT_REFUSE" }).deps;
    expect(await actionSupprimer({ photoId: PHOTO })).toMatchObject({ statut: "erreur", erreur: "non_autorise" });
    expect(await actionAlt({ photoId: PHOTO, altFr: "a", altEn: "b" })).toMatchObject({ statut: "erreur", erreur: "non_autorise" });
    faux.courant = new Error("TEST_panne");
    expect(await actionSupprimer({ photoId: PHOTO })).toMatchObject({ statut: "erreur", erreur: "generique" });
    expect(await actionAlt({ photoId: PHOTO, altFr: "a", altEn: "b" })).toMatchObject({ statut: "erreur", erreur: "generique" });
  });
});

describe("câblage réel : fonctions Postgres de suppression et de texte alternatif", () => {
  async function charger() {
    vi.resetModules();
    vi.doUnmock("@/modules/catalogue/dependances");
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/auth/droits", () => ({ exigerDroit: vi.fn() }));
    vi.doMock("next/cache", () => ({ updateTag: faux.tag }));
    vi.doMock("@/lib/supabase/service", () => ({
      creerClientService: () => ({ rpc: faux.rpc, storage: { from: () => ({ remove: faux.supprime }) }, from: () => ({}) }),
    }));
    const { dependances } = await import("@/modules/catalogue/dependances");
    return dependances();
  }

  it("supprimer_photo_produit renvoie le fichier ; modifier_alt_photo reçoit les deux textes", async () => {
    const deps = await charger();
    faux.rpc.mockReset();
    faux.rpc.mockResolvedValueOnce({ data: "p/f.jpg", error: null });
    expect(await deps.supprimerPhoto({ auteur: AUTEUR as never, photoId: PHOTO })).toEqual({ erreur: null, fichier: "p/f.jpg" });
    faux.rpc.mockResolvedValueOnce({ data: null, error: { message: "KS_PUBLICATION_INCOMPLETE" } });
    expect(await deps.supprimerPhoto({ auteur: AUTEUR as never, photoId: PHOTO })).toEqual({ erreur: "KS_PUBLICATION_INCOMPLETE", fichier: null });
    faux.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await deps.modifierAltPhoto({ auteur: AUTEUR as never, photoId: PHOTO, altFr: "a", altEn: "b" })).toEqual({ erreur: null });
    expect(faux.rpc.mock.calls.map((c) => c[0])).toEqual(["supprimer_photo_produit", "supprimer_photo_produit", "modifier_alt_photo"]);
    expect(faux.rpc.mock.calls[0][1]).toEqual({ p_auteur: AUTEUR, p_photo_id: PHOTO });
    expect(faux.rpc.mock.calls[2][1]).toEqual({ p_auteur: AUTEUR, p_photo_id: PHOTO, p_alt_fr: "a", p_alt_en: "b" });
  });
});
