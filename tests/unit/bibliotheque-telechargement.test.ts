import { describe, expect, it, vi } from "vitest";
import { DUREE_LIEN_SECONDES, nomTelechargement, preparerTelechargement, type DependancesTelechargement, type FichierAServir } from "@/modules/bibliotheque/telechargement";

const FICHIER = "00000000-0000-4000-8000-0000000000c1";

function fichier(s: Partial<FichierAServir> = {}): FichierAServir {
  return {
    fichier_id: FICHIER,
    format: "pdf_a4",
    version: 2,
    nom_fr: "Patron A4",
    nom_en: "A4 pattern",
    chemin_stockage: "TEST_produit/original.pdf",
    email: "TEST_client@example.invalid",
    numero_commande: "KS-2026-000042",
    chemin_filigrane: null,
    ...s,
  };
}

function faux(s: Partial<DependancesTelechargement> = {}): DependancesTelechargement {
  return {
    compteId: vi.fn(async () => "TEST_compte"),
    fichierAServir: vi.fn(async () => fichier()),
    nomSite: vi.fn(async () => "TEST_site"),
    libelleFiligrane: vi.fn((v) => `TEST ${v.email} ${v.numero} ${v.site}`),
    lireObjet: vi.fn(async () => new Uint8Array([1, 2, 3])),
    deposerObjet: vi.fn(async () => undefined),
    enregistrerFiligrane: vi.fn(async (_c, _f, _v, chemin) => chemin),
    police: vi.fn(async () => new Uint8Array([9])),
    filigraner: vi.fn(async () => new Uint8Array([4, 5, 6])),
    signer: vi.fn(async (chemin) => `https://TEST.invalid/signe/${chemin}`),
    ...s,
  };
}

describe("preparerTelechargement : accès (règle 1)", () => {
  it("visiteur non connecté : aucun lien, la base n'est pas interrogée", async () => {
    const deps = faux({ compteId: vi.fn(async () => null) });
    await expect(preparerTelechargement(deps, FICHIER)).resolves.toEqual({ statut: "non_connecte" });
    expect(deps.fichierAServir).not.toHaveBeenCalled();
    expect(deps.signer).not.toHaveBeenCalled();
  });
  it("Compte sans accès : refus, aucun lien, aucune lecture du stockage", async () => {
    const deps = faux({ fichierAServir: vi.fn(async () => null) });
    await expect(preparerTelechargement(deps, FICHIER)).resolves.toEqual({ statut: "refuse" });
    expect(deps.lireObjet).not.toHaveBeenCalled();
    expect(deps.signer).not.toHaveBeenCalled();
  });
  it("identifiant invalide : même refus, la base n'est pas interrogée", async () => {
    const deps = faux();
    await expect(preparerTelechargement(deps, "pas-un-uuid")).resolves.toEqual({ statut: "refuse" });
    expect(deps.fichierAServir).not.toHaveBeenCalled();
  });
  it("l'accès est vérifié avec le Compte de la session, à chaque appel", async () => {
    const deps = faux();
    await preparerTelechargement(deps, FICHIER);
    await preparerTelechargement(deps, FICHIER);
    expect(deps.fichierAServir).toHaveBeenCalledTimes(2);
    expect(deps.fichierAServir).toHaveBeenCalledWith("TEST_compte", FICHIER);
  });
});

describe("preparerTelechargement : lien signé de 60 secondes", () => {
  it("le lien est demandé pour 60 secondes (l'expiration elle-même est assurée par Supabase : test manuel) et un nouveau lien est créé à chaque clic", async () => {
    const deps = faux({ fichierAServir: vi.fn(async () => fichier({ format: "svg", chemin_stockage: "TEST/a.svg" })) });
    await preparerTelechargement(deps, FICHIER);
    await preparerTelechargement(deps, FICHIER);
    expect(DUREE_LIEN_SECONDES).toBe(60);
    expect(deps.signer).toHaveBeenCalledTimes(2);
    expect(deps.signer).toHaveBeenNthCalledWith(1, "TEST/a.svg", 60, "Patron A4.svg");
  });
});

describe("preparerTelechargement : filigrane des PDF", () => {
  it("première remise : copie filigranée créée, rangée sous filigranes/<compte>/, enregistrée, et c'est elle qui est signée", async () => {
    const deps = faux();
    const r = await preparerTelechargement(deps, FICHIER);
    expect(deps.lireObjet).toHaveBeenCalledWith("TEST_produit/original.pdf");
    expect(deps.libelleFiligrane).toHaveBeenCalledWith({ email: "TE•••@example.invalid", numero: "KS-2026-000042", site: "TEST_site" });
    expect(deps.deposerObjet).toHaveBeenCalledWith(`filigranes/TEST_compte/${FICHIER}-v2.pdf`, new Uint8Array([4, 5, 6]));
    expect(deps.enregistrerFiligrane).toHaveBeenCalledWith("TEST_compte", FICHIER, 2, `filigranes/TEST_compte/${FICHIER}-v2.pdf`);
    expect(r).toEqual({ statut: "ok", url: `https://TEST.invalid/signe/filigranes/TEST_compte/${FICHIER}-v2.pdf` });
  });
  it("l'email complet n'arrive jamais jusqu'au texte du filigrane", async () => {
    const deps = faux();
    await preparerTelechargement(deps, FICHIER);
    const texte = (deps.filigraner as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(texte).toContain("TE•••@example.invalid");
    expect(texte).not.toContain("TEST_client");
  });
  it("remises suivantes : la copie existante est réutilisée, rien n'est recalculé", async () => {
    const deps = faux({ fichierAServir: vi.fn(async () => fichier({ chemin_filigrane: "filigranes/TEST_compte/deja.pdf" })) });
    const r = await preparerTelechargement(deps, FICHIER);
    expect(deps.lireObjet).not.toHaveBeenCalled();
    expect(deps.filigraner).not.toHaveBeenCalled();
    expect(r).toEqual({ statut: "ok", url: "https://TEST.invalid/signe/filigranes/TEST_compte/deja.pdf" });
  });
  it("jamais l'original d'un PDF : si l'enregistrement est refusé (accès retiré, version remplacée), aucun lien", async () => {
    const deps = faux({ enregistrerFiligrane: vi.fn(async () => null) });
    await expect(preparerTelechargement(deps, FICHIER)).resolves.toEqual({ statut: "refuse" });
    expect(deps.signer).not.toHaveBeenCalled();
  });
  it("PDF US Letter : filigrané aussi", async () => {
    const deps = faux({ fichierAServir: vi.fn(async () => fichier({ format: "pdf_letter" })) });
    await preparerTelechargement(deps, FICHIER);
    expect(deps.filigraner).toHaveBeenCalledTimes(1);
  });
  it.each(["svg", "stl", "transcription"] as const)("%s : servi sans filigrane, depuis l'original", async (format) => {
    const deps = faux({ fichierAServir: vi.fn(async () => fichier({ format, chemin_stockage: "TEST/original" })) });
    const r = await preparerTelechargement(deps, FICHIER);
    expect(deps.filigraner).not.toHaveBeenCalled();
    expect(deps.deposerObjet).not.toHaveBeenCalled();
    expect(r).toEqual({ statut: "ok", url: "https://TEST.invalid/signe/TEST/original" });
  });
  it("le nom du site est relu à chaque copie (réglage nom_site, jamais écrit en dur)", async () => {
    const deps = faux({ nomSite: vi.fn(async () => "TEST_nouveau_nom") });
    await preparerTelechargement(deps, FICHIER);
    expect(deps.libelleFiligrane).toHaveBeenCalledWith(expect.objectContaining({ site: "TEST_nouveau_nom" }));
  });
});

describe("preparerTelechargement : échecs", () => {
  it("une panne du stockage donne « erreur », sans lien", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = faux({ lireObjet: vi.fn(async () => Promise.reject(new Error("TEST_panne"))) });
    await expect(preparerTelechargement(deps, FICHIER)).resolves.toEqual({ statut: "erreur" });
    expect(deps.signer).not.toHaveBeenCalled();
    // Le journal ne contient ni email ni chemin.
    expect(JSON.stringify(spy.mock.calls)).not.toContain("TEST_client");
    spy.mockRestore();
  });
});

describe("nomTelechargement", () => {
  it("ajoute l'extension du format, une seule fois, sans caractère de chemin", () => {
    expect(nomTelechargement({ format: "pdf_a4", nom_fr: "Patron A4" })).toBe("Patron A4.pdf");
    expect(nomTelechargement({ format: "pdf_a4", nom_fr: "Patron.pdf" })).toBe("Patron.pdf");
    expect(nomTelechargement({ format: "stl", nom_fr: "../../Casque/x" })).toBe(".. .. Casque x.stl");
    expect(nomTelechargement({ format: "transcription", nom_fr: "Texte" })).toBe("Texte.txt");
  });
});
