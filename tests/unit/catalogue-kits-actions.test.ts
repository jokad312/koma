import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerTestDependancesCatalogue, TEST_KIT_ID } from "../doubles/TEST_dependances-catalogue";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({
  courant: null as unknown,
  rpc: vi.fn(),
  signe: vi.fn(),
  info: vi.fn(),
  urlSignee: vi.fn(),
  supprime: vi.fn(),
  buckets: [] as string[],
  tables: {} as Record<string, { data: unknown; error: unknown }>,
  filtres: [] as unknown[],
  tag: vi.fn(),
}));
vi.mock("@/modules/catalogue/dependances", () => ({
  dependances: () => {
    if (faux.courant instanceof Error) throw faux.courant;
    return faux.courant;
  },
}));

import { annulerEnvoiFichierKit, demanderEnvoiFichierKit, enregistrerKit, finaliserFichierKit, supprimerFichierKit } from "@/modules/catalogue/actions";

// Les tests de Kit lisent par défaut un produit de famille « kit » (le double lit « cosplay » par défaut).
const creer = (r: Parameters<typeof creerTestDependancesCatalogue>[0] = {}) => creerTestDependancesCatalogue({ familleProduit: "kit", ...r });

const UUID = "11111111-1111-4111-8111-111111111111";
const OBJET = `${TEST_KIT_ID}/${UUID}.pdf`;
const FICHIER = "00000000-0000-4000-8000-0000000000dd";
const entreeKit = { id: "", slug: "test-kit", titreFr: "TEST_Kit", titreEn: "", descriptionFr: "", descriptionEn: "", materielFr: "", materielEn: "", universId: "", prix: "0", niveau: "", produitLieId: "" };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("Server Actions de Kit", () => {
  it("succès : rendu seulement après la réponse réelle, avec les données utiles", async () => {
    faux.courant = creer({ objetKit: { trouve: true, taille: 100, debut: new TextEncoder().encode("%PDF-1.7") } }).deps;
    expect(await enregistrerKit(entreeKit)).toEqual({ statut: "succes", id: "TEST_kit-0001", cree: true });
    expect(await demanderEnvoiFichierKit({ produitId: TEST_KIT_ID, nomFichier: "a.pdf", format: "pdf_a4", taille: 100 })).toMatchObject({ statut: "succes", jeton: "TEST_jeton-kit", contentType: "application/pdf" });
    expect(await finaliserFichierKit({ produitId: TEST_KIT_ID, objet: OBJET, format: "pdf_a4", taille: 100, nomFr: "A", nomEn: "B" })).toEqual({ statut: "succes", id: "TEST_fichier-0001" });
    expect(await supprimerFichierKit({ fichierId: FICHIER })).toEqual({ statut: "succes" });
    expect(await annulerEnvoiFichierKit({ produitId: TEST_KIT_ID, objet: OBJET })).toEqual({ statut: "succes" });
  });

  it("refus : l'erreur et le champ sont rendus", async () => {
    faux.courant = creer().deps;
    expect(await enregistrerKit({ ...entreeKit, prix: "-1" })).toEqual({ statut: "erreur", erreur: "prix_invalide", champ: "prix", slugPropose: undefined });
    faux.courant = creer({ erreurKit: "KS_KIT_LIE_INVALIDE" }).deps;
    expect(await enregistrerKit(entreeKit)).toMatchObject({ statut: "erreur", erreur: "kit_lie_invalide", champ: "kit_lie" });
  });

  it("sans droit (Assistant, Compte simple) : non_autorise pour chaque action", async () => {
    faux.courant = creer({ droit: "KS_DROIT_REFUSE" }).deps;
    const refus = { statut: "erreur", erreur: "non_autorise" };
    expect(await enregistrerKit(entreeKit)).toMatchObject(refus);
    expect(await demanderEnvoiFichierKit({ produitId: TEST_KIT_ID, nomFichier: "a.pdf", format: "pdf_a4", taille: 100 })).toMatchObject(refus);
    expect(await finaliserFichierKit({ produitId: TEST_KIT_ID, objet: OBJET, format: "pdf_a4", taille: 100, nomFr: "A", nomEn: "B" })).toMatchObject(refus);
    expect(await supprimerFichierKit({ fichierId: FICHIER })).toMatchObject(refus);
    expect(await annulerEnvoiFichierKit({ produitId: TEST_KIT_ID, objet: OBJET })).toMatchObject(refus);
  });

  it("exception inattendue : erreur générique, jamais un succès", async () => {
    faux.courant = new Error("TEST_panne");
    const generique = { statut: "erreur", erreur: "generique" };
    expect(await enregistrerKit(entreeKit)).toMatchObject(generique);
    expect(await demanderEnvoiFichierKit({ produitId: TEST_KIT_ID, nomFichier: "a.pdf", format: "pdf_a4", taille: 100 })).toMatchObject(generique);
    expect(await finaliserFichierKit({ produitId: TEST_KIT_ID, objet: OBJET, format: "pdf_a4", taille: 100, nomFr: "A", nomEn: "B" })).toMatchObject(generique);
    expect(await supprimerFichierKit({ fichierId: FICHIER })).toMatchObject(generique);
    expect(await annulerEnvoiFichierKit({ produitId: TEST_KIT_ID, objet: OBJET })).toMatchObject(generique);
  });
});

// Câblage réel (sans réseau) : les bonnes fonctions Postgres, le bon bucket privé, l'étiquette « catalogue ».
describe("câblage réel de modules/catalogue pour les Kits", () => {
  const AUTEUR = { type: "compte" as const, id: "TEST_admin", role: "admin" as const };

  async function charger() {
    vi.resetModules();
    vi.doUnmock("@/modules/catalogue/dependances");
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/auth/droits", () => ({ exigerDroit: vi.fn() }));
    vi.doMock("next/cache", () => ({ updateTag: faux.tag, cacheTag: vi.fn() }));
    vi.doMock("@/lib/supabase/service", () => ({
      creerClientService: () => ({
        rpc: faux.rpc,
        storage: {
          from: (bucket: string) => {
            faux.buckets.push(bucket);
            return { createSignedUploadUrl: faux.signe, info: faux.info, createSignedUrl: faux.urlSignee, remove: faux.supprime };
          },
        },
        from: (table: string) => {
          const requete: Record<string, unknown> = {
            select: () => requete,
            eq: (colonne: string, valeur: unknown) => {
              faux.filtres.push([table, "eq", colonne, valeur]);
              return requete;
            },
            in: () => requete,
            not: () => requete,
            order: () => requete,
            maybeSingle: async () => faux.tables[table] ?? { data: null, error: null },
            then: (resolve: (v: unknown) => unknown) => resolve(faux.tables[table] ?? { data: [], error: null }),
          };
          return requete;
        },
      }),
    }));
    const { dependances } = await import("@/modules/catalogue/dependances");
    return dependances();
  }

  beforeEach(() => {
    for (const m of [faux.rpc, faux.signe, faux.info, faux.urlSignee, faux.supprime, faux.tag]) m.mockReset();
    faux.buckets = [];
    faux.tables = {};
    faux.filtres = [];
    vi.unstubAllGlobals();
  });

  it("fonctions Postgres : enregistrer_kit, ajouter, remplacer, supprimer", async () => {
    const deps = await charger();
    const kit = { famille: "kit" as const, slug: "x", titre_fr: "X", titre_en: null, description_fr: null, description_en: null, materiel_fr: null, materiel_en: null, univers_id: null, prix_cents: 0, niveau: null, produit_lie_id: null };
    faux.rpc.mockResolvedValueOnce({ data: "TEST_kit", error: null });
    expect(await deps.ecrireKit({ auteur: AUTEUR, id: null, kit })).toEqual({ erreur: null, id: "TEST_kit" });
    faux.rpc.mockResolvedValueOnce({ data: "TEST_f", error: null });
    expect(await deps.ecrireFichierKit({ auteur: AUTEUR, produitId: TEST_KIT_ID, nomFr: "A", nomEn: "B", format: "pdf_a4", taille: 100, chemin: OBJET })).toEqual({ erreur: null, id: "TEST_f" });
    faux.rpc.mockResolvedValueOnce({ data: "ancien.pdf", error: null });
    expect(await deps.remplacerFichierKit({ auteur: AUTEUR, fichierId: FICHIER, taille: 200, chemin: OBJET })).toEqual({ erreur: null, ancienChemin: "ancien.pdf" });
    faux.rpc.mockResolvedValueOnce({ data: "a.pdf", error: null });
    expect(await deps.supprimerFichierKit({ auteur: AUTEUR, fichierId: FICHIER })).toEqual({ erreur: null, chemin: "a.pdf" });
    expect(faux.rpc.mock.calls.map((c) => c[0])).toEqual(["enregistrer_kit", "ajouter_fichier_kit", "remplacer_fichier_kit", "supprimer_fichier_kit"]);
    expect(faux.rpc.mock.calls[0][1]).toEqual({ p_auteur: AUTEUR, p_id: null, p_kit: kit });
    expect(faux.rpc.mock.calls[1][1]).toEqual({ p_auteur: AUTEUR, p_produit_id: TEST_KIT_ID, p_nom_fr: "A", p_nom_en: "B", p_format: "pdf_a4", p_taille: 100, p_chemin: OBJET });
    expect(faux.rpc.mock.calls[2][1]).toEqual({ p_auteur: AUTEUR, p_fichier_id: FICHIER, p_taille: 200, p_chemin: OBJET });
    expect(faux.rpc.mock.calls[3][1]).toEqual({ p_auteur: AUTEUR, p_fichier_id: FICHIER });
  });

  it("une erreur Postgres est rendue en texte, sans identifiant ni chemin", async () => {
    const deps = await charger();
    faux.rpc.mockResolvedValue({ data: null, error: { message: "KS_CHEMIN_INVALIDE" } });
    expect(await deps.ecrireFichierKit({ auteur: AUTEUR, produitId: TEST_KIT_ID, nomFr: "A", nomEn: "B", format: "svg", taille: 1, chemin: "x" })).toEqual({ erreur: "KS_CHEMIN_INVALIDE", id: null });
    expect(await deps.remplacerFichierKit({ auteur: AUTEUR, fichierId: FICHIER, taille: 1, chemin: "x" })).toEqual({ erreur: "KS_CHEMIN_INVALIDE", ancienChemin: null });
    expect(await deps.supprimerFichierKit({ auteur: AUTEUR, fichierId: FICHIER })).toEqual({ erreur: "KS_CHEMIN_INVALIDE", chemin: null });
  });

  it("signature, effacement : toujours le bucket privé kits-private", async () => {
    const deps = await charger();
    faux.signe.mockResolvedValueOnce({ data: { token: "TEST_jeton" }, error: null });
    expect(await deps.signerEnvoiFichierKit({ objet: OBJET })).toEqual({ erreur: null, jeton: "TEST_jeton" });
    expect(faux.signe).toHaveBeenCalledWith(OBJET);
    faux.supprime.mockResolvedValueOnce({ error: null });
    await deps.supprimerObjets({ bucket: "kits-private", objets: [OBJET] });
    expect(faux.buckets).toEqual(["kits-private", "kits-private"]);
    faux.signe.mockResolvedValueOnce({ data: null, error: { message: "TEST_refus" } });
    expect(await deps.signerEnvoiFichierKit({ objet: OBJET })).toEqual({ erreur: "TEST_refus", jeton: null });
  });

  it("lireObjetKit : objet absent (404) : trouve false, sans erreur", async () => {
    const deps = await charger();
    faux.info.mockResolvedValueOnce({ data: null, error: { message: "Object not found", status: 404 } });
    expect(await deps.lireObjetKit({ objet: OBJET, octets: 8 })).toMatchObject({ erreur: null, trouve: false, taille: 0 });
    faux.info.mockResolvedValueOnce({ data: null, error: { message: "Object not found" } });
    expect(await deps.lireObjetKit({ objet: OBJET, octets: 8 })).toMatchObject({ erreur: null, trouve: false });
    faux.info.mockResolvedValueOnce({ data: null, error: { message: "TEST_panne", status: 500 } });
    expect(await deps.lireObjetKit({ objet: OBJET, octets: 8 })).toMatchObject({ erreur: "TEST_panne", trouve: false });
  });

  it("lireObjetKit : taille par les métadonnées, début par une requête d'intervalle sur un lien signé de 60 s", async () => {
    const deps = await charger();
    faux.info.mockResolvedValueOnce({ data: { size: 3_000_000 }, error: null });
    faux.urlSignee.mockResolvedValueOnce({ data: { signedUrl: "http://stockage.test/signe?token=TEST" }, error: null });
    const fetchFaux = vi.fn(async () => new Response(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]), { status: 206 }));
    vi.stubGlobal("fetch", fetchFaux);
    const lu = await deps.lireObjetKit({ objet: OBJET, octets: 8 });
    expect(lu.erreur).toBeNull();
    expect(lu.trouve).toBe(true);
    expect(lu.taille).toBe(3_000_000);
    expect(new TextDecoder().decode(lu.debut)).toBe("%PDF-1.7");
    expect(faux.urlSignee).toHaveBeenCalledWith(OBJET, 60);
    expect(fetchFaux).toHaveBeenCalledWith("http://stockage.test/signe?token=TEST", { headers: { Range: "bytes=0-7" }, signal: expect.any(AbortSignal) });
  });

  it("lireObjetKit : un serveur qui renvoie tout l'objet (200) n'est lu que sur les premiers octets demandés", async () => {
    const deps = await charger();
    faux.info.mockResolvedValueOnce({ data: { size: 20 }, error: null });
    faux.urlSignee.mockResolvedValueOnce({ data: { signedUrl: "http://stockage.test/signe" }, error: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new TextEncoder().encode("0123456789ABCDEFGHIJ"), { status: 200 })));
    const lu = await deps.lireObjetKit({ objet: OBJET, octets: 5 });
    expect(new TextDecoder().decode(lu.debut)).toBe("01234");
  });

  it("lireObjetKit : jamais plus que la taille de l'objet ; erreurs du stockage rendues en texte", async () => {
    const deps = await charger();
    faux.info.mockResolvedValueOnce({ data: { size: 4 }, error: null });
    faux.urlSignee.mockResolvedValueOnce({ data: { signedUrl: "http://stockage.test/signe" }, error: null });
    const fetchFaux = vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 206 }));
    vi.stubGlobal("fetch", fetchFaux);
    expect((await deps.lireObjetKit({ objet: OBJET, octets: 1024 })).debut).toHaveLength(4);
    expect(fetchFaux).toHaveBeenCalledWith("http://stockage.test/signe", { headers: { Range: "bytes=0-3" }, signal: expect.any(AbortSignal) });

    faux.info.mockResolvedValueOnce({ data: { size: 4 }, error: null });
    faux.urlSignee.mockResolvedValueOnce({ data: null, error: { message: "TEST_lien" } });
    expect((await deps.lireObjetKit({ objet: OBJET, octets: 4 })).erreur).toBe("TEST_lien");

    faux.info.mockResolvedValueOnce({ data: { size: 4 }, error: null });
    faux.urlSignee.mockResolvedValueOnce({ data: { signedUrl: "http://stockage.test/signe" }, error: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    expect((await deps.lireObjetKit({ objet: OBJET, octets: 4 })).erreur).toContain("403");

    // Délai dépassé ou réseau coupé : erreur rendue en texte, jamais une exception.
    faux.info.mockResolvedValueOnce({ data: { size: 4 }, error: null });
    faux.urlSignee.mockResolvedValueOnce({ data: { signedUrl: "http://stockage.test/signe" }, error: null });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("TimeoutError", "TimeoutError");
    }));
    expect((await deps.lireObjetKit({ objet: OBJET, octets: 4 })).erreur).toContain("délai");

    faux.info.mockResolvedValueOnce({ data: {}, error: null });
    expect((await deps.lireObjetKit({ objet: OBJET, octets: 4 })).erreur).not.toBeNull();
  });

  it("lectures : famille, fichier de Kit (sans chemin), produits à lier", async () => {
    await charger();
    const q = await import("@/modules/catalogue/queries");
    faux.tables.produit = { data: { famille: "kit" }, error: null };
    expect(await q.lireFamilleProduit(TEST_KIT_ID)).toBe("kit");
    faux.tables.produit = { data: null, error: null };
    expect(await q.lireFamilleProduit(TEST_KIT_ID)).toBeNull();
    faux.tables.produit = { data: null, error: { message: "TEST" } };
    await expect(q.lireFamilleProduit(TEST_KIT_ID)).rejects.toThrow();
    faux.tables.fichier_kit = { data: { produit_id: TEST_KIT_ID, format: "svg" }, error: null };
    expect(await q.lireFichierKit(FICHIER)).toEqual({ produitId: TEST_KIT_ID, format: "svg" });
    faux.tables.fichier_kit = { data: null, error: null };
    expect(await q.lireFichierKit(FICHIER)).toBeNull();
  });

  it("produits à lier : sans Kit, plus celui du Kit édité", async () => {
    // Deux lectures lancées ensemble : d'abord les cosplays et accessoires, ensuite les Kits déjà liés.
    const cibles = [
      { id: "TEST_a", titre_fr: "TEST_A", famille: "cosplay" },
      { id: "TEST_b", titre_fr: "TEST_B", famille: "accessoire" },
      { id: "TEST_c", titre_fr: "TEST_C", famille: "cosplay" },
    ];
    const kits = [
      { id: "TEST_k1", produit_lie_id: "TEST_a" },
      { id: "TEST_k2", produit_lie_id: "TEST_b" },
    ];
    let n = 0;
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("next/cache", () => ({ updateTag: faux.tag, cacheTag: vi.fn() }));
    vi.doMock("@/lib/supabase/service", () => ({
      creerClientService: () => ({
        from: () => {
          const requete: Record<string, unknown> = {
            select: () => requete,
            in: () => requete,
            eq: () => requete,
            not: () => requete,
            order: () => requete,
            then: (resolve: (v: unknown) => unknown) => resolve({ data: n++ % 2 === 0 ? cibles : kits, error: null }),
          };
          return requete;
        },
      }),
    }));
    const q = await import("@/modules/catalogue/queries");
    expect(await q.lireProduitsLiables(null)).toEqual([{ id: "TEST_c", titreFr: "TEST_C", famille: "cosplay" }]);
    expect((await q.lireProduitsLiables("TEST_k1")).map((c) => c.id)).toEqual(["TEST_a", "TEST_c"]);
  });

  it("invalidation de l'étiquette « catalogue » après un succès", async () => {
    const deps = await charger();
    await deps.invaliderCatalogue();
    expect(faux.tag).toHaveBeenCalledWith("catalogue");
  });
});
