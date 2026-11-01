import { beforeEach, describe, expect, it, vi } from "vitest";
import { signerPanier } from "@/lib/panier/cookie";
import { ajouter, compter, lire, modifier, retirer } from "@/modules/panier/service";
import type { DependancesPanier, LigneBrute } from "@/modules/panier/types";

const SECRET = "TEST_secret-du-panier-de-test-0123456789";
const PANIER = "5b0e7b0e-6c1c-4c43-9c5e-7d6c2d1b8a11";
const NEUF = "6c1f8c1f-7d2d-4d54-8d6f-8e7d3e2c9b22";
const PRODUIT = "00000000-0000-4000-8000-0000000000aa";
const LIGNE = "00000000-0000-4000-8000-0000000000cc";

const etat = vi.hoisted(() => ({ cookie: null as string | null, poses: [] as string[] }));

function faux(s: Partial<DependancesPanier> = {}): DependancesPanier {
  return {
    lireCookie: vi.fn(async () => etat.cookie),
    poserCookie: vi.fn(async (v: string) => {
      etat.poses.push(v);
    }),
    secret: () => SECRET,
    compteId: vi.fn(async () => null),
    creerPanier: vi.fn(async () => ({ id: NEUF })),
    ajouter: vi.fn(async () => ({ erreur: null })),
    modifier: vi.fn(async () => ({ erreur: null })),
    retirer: vi.fn(async () => ({ erreur: null })),
    lire: vi.fn(async () => ({ lignes: [] as LigneBrute[] })),
    compter: vi.fn(async () => ({ nombre: 3 })),
    ...s,
  };
}

const brute = (s: Partial<LigneBrute> = {}): LigneBrute => ({
  ligne_id: LIGNE,
  produit_id: PRODUIT,
  famille: "cosplay",
  slug: "test-cosplay",
  titre_fr: "TEST_Cosplay",
  titre_en: "TEST_Cosplay en",
  taille: "M",
  nombre: 2,
  prix_cents: 5000,
  etat: "disponible",
  delai_jours: null,
  ...s,
});

beforeEach(() => {
  etat.cookie = null;
  etat.poses = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ajouter", () => {
  it("sans cookie : crée un Panier, pose le cookie signé après la réponse de la base, puis ajoute", async () => {
    const deps = faux();
    const r = await ajouter(deps, { produitId: PRODUIT, taille: "M", nombre: 2 });
    expect(r).toEqual({ ok: true, nombre: 3 });
    expect(etat.poses).toEqual([signerPanier(NEUF, SECRET)]);
    expect(deps.ajouter).toHaveBeenCalledWith(expect.objectContaining({ panierId: NEUF, produitId: PRODUIT, taille: "M", nombre: 2 }));
  });

  it("n'écrit aucun cookie quand la création du Panier échoue (règle 13)", async () => {
    const deps = faux({ creerPanier: vi.fn(async () => ({ erreur: "x" })) });
    await expect(ajouter(deps, { produitId: PRODUIT, taille: "M" })).resolves.toEqual({ ok: false, erreur: "erreur" });
    expect(etat.poses).toEqual([]);
    expect(deps.ajouter).not.toHaveBeenCalled();
  });

  it("cookie valide : réutilise le Panier, sans en créer un autre", async () => {
    etat.cookie = signerPanier(PANIER, SECRET);
    const deps = faux();
    await ajouter(deps, { produitId: PRODUIT, taille: "M" });
    expect(deps.creerPanier).not.toHaveBeenCalled();
    expect(deps.ajouter).toHaveBeenCalledWith(expect.objectContaining({ panierId: PANIER, nombre: 1 }));
  });

  it("cookie modifié ou d'un autre secret : traité comme absent", async () => {
    etat.cookie = signerPanier(PANIER, "TEST_un-autre-secret-0123456789abcdefghi");
    const deps = faux();
    await ajouter(deps, { produitId: PRODUIT, taille: "M" });
    expect(deps.creerPanier).toHaveBeenCalledTimes(1);
  });

  it("Panier du cookie inconnu de la base : un nouveau Panier, une seule reprise", async () => {
    etat.cookie = signerPanier(PANIER, SECRET);
    const ajoutMock = vi.fn().mockResolvedValueOnce({ erreur: "KS_PANIER_INTROUVABLE" }).mockResolvedValueOnce({ erreur: null });
    const deps = faux({ ajouter: ajoutMock });
    await expect(ajouter(deps, { produitId: PRODUIT, taille: "M" })).resolves.toMatchObject({ ok: true });
    expect(deps.creerPanier).toHaveBeenCalledTimes(1);
    expect(etat.poses).toEqual([signerPanier(NEUF, SECRET)]);
    expect(ajoutMock).toHaveBeenCalledTimes(2);
  });

  it("utilise le Compte connecté comme auteur et pour le contrôle du Kit déjà possédé", async () => {
    const deps = faux({ compteId: vi.fn(async () => "TEST_compte") });
    await ajouter(deps, { produitId: PRODUIT });
    expect(deps.ajouter).toHaveBeenCalledWith(expect.objectContaining({ compteId: "TEST_compte", auteur: { type: "compte", id: "TEST_compte", role: null } }));
  });

  it("visiteur sans Compte : auteur « visiteur »", async () => {
    const deps = faux();
    await ajouter(deps, { produitId: PRODUIT, taille: "M" });
    expect(deps.ajouter).toHaveBeenCalledWith(expect.objectContaining({ compteId: null, auteur: { type: "visiteur" } }));
  });

  it.each([
    ["KS_PRODUIT_GRATUIT", "gratuit"],
    ["KS_KIT_DEJA_POSSEDE", "deja_possede"],
    ["KS_PRODUIT_INTROUVABLE", "introuvable"],
    ["KS_INDISPONIBLE", "indisponible"],
    ["KS_VARIANTE_INTROUVABLE", "taille"],
    ["KS_QUANTITE_INVALIDE", "quantite"],
  ])("traduit le refus %s de la base en %s", async (codeBase, attendu) => {
    const deps = faux({ ajouter: vi.fn(async () => ({ erreur: codeBase })) });
    await expect(ajouter(deps, { produitId: PRODUIT, taille: "M" })).resolves.toEqual({ ok: false, erreur: attendu });
  });

  it("refuse une entrée invalide sans toucher à la base : produit, taille ou quantité hors bornes", async () => {
    const deps = faux();
    await expect(ajouter(deps, { produitId: "pas-un-uuid" })).resolves.toEqual({ ok: false, erreur: "invalide" });
    await expect(ajouter(deps, { produitId: PRODUIT, taille: "XXXL" as never })).resolves.toEqual({ ok: false, erreur: "invalide" });
    await expect(ajouter(deps, { produitId: PRODUIT, taille: "M", nombre: 11 })).resolves.toEqual({ ok: false, erreur: "invalide" });
    await expect(ajouter(deps, { produitId: PRODUIT, taille: "M", nombre: 0 })).resolves.toEqual({ ok: false, erreur: "invalide" });
    expect(deps.creerPanier).not.toHaveBeenCalled();
    expect(deps.ajouter).not.toHaveBeenCalled();
  });

  it("une erreur inconnue ou une exception ne devient jamais un succès, et rien de personnel n'est journalisé", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const inconnue = faux({ ajouter: vi.fn(async () => ({ erreur: "détail secret TEST_compte" })) });
    await expect(ajouter(inconnue, { produitId: PRODUIT, taille: "M" })).resolves.toEqual({ ok: false, erreur: "erreur" });
    const exception = faux({ ajouter: vi.fn(async () => { throw new Error("réseau"); }) });
    await expect(ajouter(exception, { produitId: PRODUIT, taille: "M" })).resolves.toEqual({ ok: false, erreur: "erreur" });
    const texte = spy.mock.calls.flat().join(" ");
    expect(texte).not.toContain("secret");
    expect(texte).not.toContain("TEST_compte");
  });
});

describe("modifier et retirer", () => {
  it("sans Panier : introuvable, sans toucher à la base", async () => {
    const deps = faux();
    await expect(modifier(deps, { ligneId: LIGNE, nombre: 2 })).resolves.toEqual({ ok: false, erreur: "introuvable" });
    await expect(retirer(deps, { ligneId: LIGNE })).resolves.toEqual({ ok: false, erreur: "introuvable" });
    expect(deps.modifier).not.toHaveBeenCalled();
    expect(deps.retirer).not.toHaveBeenCalled();
  });

  it("avec le Panier du cookie : transmet la ligne et le nombre", async () => {
    etat.cookie = signerPanier(PANIER, SECRET);
    const deps = faux();
    await expect(modifier(deps, { ligneId: LIGNE, nombre: 4 })).resolves.toEqual({ ok: true });
    expect(deps.modifier).toHaveBeenCalledWith(expect.objectContaining({ panierId: PANIER, ligneId: LIGNE, nombre: 4 }));
    await expect(retirer(deps, { ligneId: LIGNE })).resolves.toEqual({ ok: true });
    expect(deps.retirer).toHaveBeenCalledWith(expect.objectContaining({ panierId: PANIER, ligneId: LIGNE }));
  });

  it("refuse une quantité hors de 1 à 10, une ligne de Kit, une ligne disparue", async () => {
    etat.cookie = signerPanier(PANIER, SECRET);
    const deps = faux();
    await expect(modifier(deps, { ligneId: LIGNE, nombre: 11 })).resolves.toEqual({ ok: false, erreur: "quantite" });
    await expect(modifier(deps, { ligneId: LIGNE, nombre: Number.NaN })).resolves.toEqual({ ok: false, erreur: "quantite" });
    const kit = faux({ modifier: vi.fn(async () => ({ erreur: "KS_LIGNE_UNIQUE" })) });
    await expect(modifier(kit, { ligneId: LIGNE, nombre: 2 })).resolves.toEqual({ ok: false, erreur: "ligne_unique" });
    const disparue = faux({ retirer: vi.fn(async () => ({ erreur: "KS_LIGNE_INTROUVABLE" })) });
    await expect(retirer(disparue, { ligneId: LIGNE })).resolves.toEqual({ ok: false, erreur: "introuvable" });
  });
});

describe("lire et compter", () => {
  it("sans cookie : Panier vide, sans interroger la base", async () => {
    const deps = faux();
    await expect(lire(deps, "fr")).resolves.toEqual({ lignes: [], nombreArticles: 0, sousTotalCents: 0, bloque: false });
    await expect(compter(deps)).resolves.toBe(0);
    expect(deps.lire).not.toHaveBeenCalled();
    expect(deps.compter).not.toHaveBeenCalled();
  });

  it("relit les lignes en base : titre dans la langue, sous-total des lignes disponibles seulement", async () => {
    etat.cookie = signerPanier(PANIER, SECRET);
    const deps = faux({
      lire: vi.fn(async () => ({
        lignes: [brute(), brute({ ligne_id: "00000000-0000-4000-8000-0000000000dd", taille: "L", nombre: 1, prix_cents: 7000, etat: "epuise" })],
      })),
    });
    const fr = await lire(deps, "fr");
    expect(fr?.lignes[0].titre).toBe("TEST_Cosplay");
    expect(fr?.sousTotalCents).toBe(10000);
    expect(fr?.nombreArticles).toBe(3);
    expect(fr?.bloque).toBe(true);
    expect((await lire(deps, "en"))?.lignes[0].titre).toBe("TEST_Cosplay en");
  });

  it("aucun prix n'est gardé : chaque lecture interroge la base", async () => {
    etat.cookie = signerPanier(PANIER, SECRET);
    const deps = faux({ lire: vi.fn(async () => ({ lignes: [brute()] })) });
    await lire(deps, "fr");
    await lire(deps, "fr");
    expect(deps.lire).toHaveBeenCalledTimes(2);
  });

  it("une ligne d'état ou de famille inconnus est écartée, jamais affichée à tort", async () => {
    etat.cookie = signerPanier(PANIER, SECRET);
    const deps = faux({ lire: vi.fn(async () => ({ lignes: [brute({ etat: "magique" }), brute({ famille: "pass" })] })) });
    expect((await lire(deps, "fr"))?.lignes).toEqual([]);
  });

  it("lecture impossible : null pour la page, 0 pour l'en-tête", async () => {
    etat.cookie = signerPanier(PANIER, SECRET);
    const deps = faux({ lire: vi.fn(async () => ({ erreur: "x" })), compter: vi.fn(async () => ({ erreur: "x" })) });
    await expect(lire(deps, "fr")).resolves.toBeNull();
    await expect(compter(deps)).resolves.toBe(0);
  });
});
