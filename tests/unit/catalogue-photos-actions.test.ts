import { beforeEach, describe, expect, it, vi } from "vitest";
import { creerTestDependancesCatalogue } from "../doubles/TEST_dependances-catalogue";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({
  courant: null as unknown,
  rpc: vi.fn(),
  signe: vi.fn(),
  telecharge: vi.fn(),
  televerse: vi.fn(),
  supprime: vi.fn(),
  compteurs: { photo: 0, variante: 0 },
  produit: { data: null as unknown, error: null as unknown },
  tag: vi.fn(),
  buckets: [] as string[],
}));
vi.mock("@/modules/catalogue/dependances", () => ({
  dependances: () => {
    if (faux.courant instanceof Error) throw faux.courant;
    return faux.courant;
  },
}));

import { annulerEnvoiPhoto, demanderEnvoiPhoto, depublierProduit, deplacerPhoto, finaliserPhoto, publierProduit } from "@/modules/catalogue/actions";

const PRODUIT = "00000000-0000-4000-8000-0000000000bb";
const PHOTO = "00000000-0000-4000-8000-0000000000dd";
const OBJET = `${PRODUIT}/11111111-1111-4111-8111-111111111111.jpg`;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Server Actions de photo et de publication", () => {
  it("succès : rendu seulement après la réponse réelle, avec les données utiles", async () => {
    faux.courant = creerTestDependancesCatalogue().deps;
    const envoi = await demanderEnvoiPhoto({ produitId: PRODUIT, type: "image/png", taille: 10, altFr: "a", altEn: "b" });
    expect(envoi).toMatchObject({ statut: "succes", jeton: "TEST_jeton" });
    expect(await deplacerPhoto({ photoId: PHOTO, sens: "haut" })).toEqual({ statut: "succes" });
    expect(await publierProduit({ id: PRODUIT })).toEqual({ statut: "succes" });
    expect(await depublierProduit({ id: PRODUIT })).toEqual({ statut: "succes" });
    expect(await annulerEnvoiPhoto({ produitId: PRODUIT, objet: OBJET })).toEqual({ statut: "succes" });
  });

  it("refus : l'erreur et la liste des manques sont rendues", async () => {
    faux.courant = creerTestDependancesCatalogue({ produitComplet: { prixCents: null, titreEn: "x", descriptionFr: "x", descriptionEn: "x", nbPhotos: 1, nbVariantes: 1, publieLe: null } }).deps;
    expect(await publierProduit({ id: PRODUIT })).toEqual({ statut: "erreur", erreur: "publication_incomplete", manques: ["prix"] });
  });

  it("sans droit (Assistant, Compte simple) : non_autorise pour chaque action", async () => {
    faux.courant = creerTestDependancesCatalogue({ droit: "KS_DROIT_REFUSE" }).deps;
    const refus = { statut: "erreur", erreur: "non_autorise" };
    expect(await demanderEnvoiPhoto({ produitId: PRODUIT, type: "image/png", taille: 10, altFr: "a", altEn: "b" })).toMatchObject(refus);
    expect(await finaliserPhoto({ produitId: PRODUIT, objet: OBJET, altFr: "a", altEn: "b" })).toMatchObject(refus);
    expect(await deplacerPhoto({ photoId: PHOTO, sens: "haut" })).toMatchObject(refus);
    expect(await publierProduit({ id: PRODUIT })).toMatchObject(refus);
    expect(await depublierProduit({ id: PRODUIT })).toMatchObject(refus);
    expect(await annulerEnvoiPhoto({ produitId: PRODUIT, objet: OBJET })).toMatchObject(refus);
  });

  it("exception inattendue : erreur générique, jamais un succès", async () => {
    faux.courant = new Error("TEST_panne");
    const generique = { statut: "erreur", erreur: "generique" };
    expect(await demanderEnvoiPhoto({ produitId: PRODUIT, type: "image/png", taille: 10, altFr: "a", altEn: "b" })).toMatchObject(generique);
    expect(await finaliserPhoto({ produitId: PRODUIT, objet: OBJET, altFr: "a", altEn: "b" })).toMatchObject(generique);
    expect(await deplacerPhoto({ photoId: PHOTO, sens: "haut" })).toMatchObject(generique);
    expect(await publierProduit({ id: PRODUIT })).toMatchObject(generique);
    expect(await depublierProduit({ id: PRODUIT })).toMatchObject(generique);
  });
});

// Câblage réel (sans réseau) : les bonnes fonctions Postgres, les bons buckets, l'étiquette « catalogue ».
describe("câblage réel de modules/catalogue pour les photos", () => {
  const AUTEUR = { type: "compte" as const, id: "TEST_admin", role: "admin" as const };

  async function charger() {
    vi.resetModules();
    vi.doUnmock("@/modules/catalogue/dependances");
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/auth/droits", () => ({ exigerDroit: vi.fn() }));
    vi.doMock("next/cache", () => ({ updateTag: faux.tag }));
    vi.doMock("@/lib/supabase/service", () => ({
      creerClientService: () => ({
        rpc: faux.rpc,
        storage: {
          from: (bucket: string) => {
            faux.buckets.push(bucket);
            return { createSignedUploadUrl: faux.signe, download: faux.telecharge, upload: faux.televerse, remove: faux.supprime };
          },
        },
        from: () => {
          const requete: Record<string, unknown> = {
            select: () => requete,
            eq: () => requete,
            maybeSingle: async () => faux.produit,
            then: (resolve: (v: unknown) => unknown) => resolve({ error: null, count: 2 }),
          };
          return requete;
        },
      }),
    }));
    const { dependances } = await import("@/modules/catalogue/dependances");
    return dependances();
  }

  beforeEach(() => {
    faux.rpc.mockReset();
    faux.signe.mockReset();
    faux.telecharge.mockReset();
    faux.televerse.mockReset();
    faux.supprime.mockReset();
    faux.tag.mockReset();
    faux.buckets = [];
  });

  it("signature, lecture, écriture publique et effacement passent par les bons buckets", async () => {
    const deps = await charger();
    faux.signe.mockResolvedValueOnce({ data: { token: "TEST_jeton" }, error: null });
    expect(await deps.signerEnvoiPhoto({ objet: OBJET })).toEqual({ erreur: null, jeton: "TEST_jeton" });
    faux.telecharge.mockResolvedValueOnce({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null });
    const lu = await deps.lireObjetAttente(OBJET);
    expect(Array.from(lu.octets ?? [])).toEqual([1, 2, 3]);
    faux.televerse.mockResolvedValueOnce({ error: null });
    expect(await deps.ecrireObjetPublic({ objet: OBJET, octets: new Uint8Array([1]), contentType: "image/jpeg" })).toEqual({ erreur: null });
    expect(faux.televerse.mock.calls[0][2]).toMatchObject({ contentType: "image/jpeg", upsert: false });
    faux.supprime.mockResolvedValueOnce({ error: null });
    await deps.supprimerObjets({ bucket: "galerie-attente", objets: [OBJET] });
    expect(faux.buckets).toEqual(["galerie-attente", "galerie-attente", "produits-public", "galerie-attente"]);
  });

  it("une erreur du stockage est rendue en texte, jamais avalée", async () => {
    const deps = await charger();
    faux.signe.mockResolvedValueOnce({ data: null, error: { message: "TEST_refus" } });
    expect(await deps.signerEnvoiPhoto({ objet: OBJET })).toEqual({ erreur: "TEST_refus", jeton: null });
    faux.telecharge.mockResolvedValueOnce({ data: null, error: { message: "TEST_absent" } });
    expect((await deps.lireObjetAttente(OBJET)).erreur).toBe("TEST_absent");
  });

  it("fonctions Postgres : ajouter, déplacer, publier, dépublier", async () => {
    const deps = await charger();
    faux.rpc.mockResolvedValue({ data: "TEST_photo-1", error: null });
    expect(await deps.ecrirePhoto({ auteur: AUTEUR, produitId: PRODUIT, fichier: OBJET, altFr: "a", altEn: "b" })).toEqual({ erreur: null, id: "TEST_photo-1" });
    await deps.deplacerPhoto({ auteur: AUTEUR, photoId: PHOTO, sens: "bas" });
    await deps.changerPublication({ auteur: AUTEUR, id: PRODUIT, publier: true });
    await deps.changerPublication({ auteur: AUTEUR, id: PRODUIT, publier: false });
    expect(faux.rpc.mock.calls.map((c) => c[0])).toEqual(["ajouter_photo_produit", "deplacer_photo_produit", "publier_produit", "depublier_produit"]);
    expect(faux.rpc.mock.calls[0][1]).toEqual({ p_auteur: AUTEUR, p_produit_id: PRODUIT, p_fichier: OBJET, p_alt_fr: "a", p_alt_en: "b" });
    expect(faux.rpc.mock.calls[2][1]).toEqual({ p_auteur: AUTEUR, p_id: PRODUIT });
  });

  it("erreur Postgres rendue ; invalidation de l'étiquette « catalogue »", async () => {
    const deps = await charger();
    faux.rpc.mockResolvedValueOnce({ data: null, error: { message: "KS_PUBLICATION_INCOMPLETE" } });
    expect(await deps.changerPublication({ auteur: AUTEUR, id: PRODUIT, publier: true })).toEqual({ erreur: "KS_PUBLICATION_INCOMPLETE" });
    await deps.invaliderCatalogue();
    expect(faux.tag).toHaveBeenCalledWith("catalogue");
  });

  it("complétude : comptes de photos et de variantes lus en base", async () => {
    const deps = await charger();
    faux.produit = { data: { prix_cents: 100, titre_en: "t", description_fr: "d", description_en: "e", publie_le: null }, error: null };
    expect(await deps.lireProduitComplet(PRODUIT)).toEqual({ prixCents: 100, titreEn: "t", descriptionFr: "d", descriptionEn: "e", nbPhotos: 2, nbVariantes: 2, publieLe: null });
    faux.produit = { data: null, error: null };
    expect(await deps.lireProduitComplet(PRODUIT)).toBeNull();
    faux.produit = { data: null, error: { message: "TEST" } };
    await expect(deps.lireProduitComplet(PRODUIT)).rejects.toThrow();
  });
});
