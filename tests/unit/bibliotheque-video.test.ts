import { describe, expect, it, vi } from "vitest";
import { chapitresTermines, enregistrerPosition, indexChapitre, preparerLecture, type DependancesVideo, type VideoALire } from "@/modules/bibliotheque/video";

const PRODUIT = "00000000-0000-4000-8000-0000000000aa";

function video(s: Partial<VideoALire> = {}): VideoALire {
  return { produit_id: PRODUIT, video_prive: "TEST_video_privee", duree_secondes: 600, sous_titres: ["fr", "en"], position_secondes: 120, ...s };
}

function faux(s: Partial<DependancesVideo> = {}): DependancesVideo {
  return {
    compteId: vi.fn(async () => "TEST_compte"),
    videoALire: vi.fn(async () => video()),
    adresses: vi.fn((id: string, expire: number) => ({
      playlist: `https://TEST.invalid/${id}/${expire}/playlist.m3u8`,
      sousTitres: (l: "fr" | "en") => `https://TEST.invalid/${id}/${expire}/${l}.vtt`,
    })),
    maintenantSecondes: vi.fn(() => 1_000_000),
    dureeJetonSecondes: 14_400,
    enregistrerProgression: vi.fn(async () => true),
    ...s,
  };
}

describe("preparerLecture : accès (règle 1)", () => {
  it("visiteur non connecté : aucun jeton, la base n'est pas interrogée", async () => {
    const deps = faux({ compteId: vi.fn(async () => null) });
    await expect(preparerLecture(deps, "kit-test")).resolves.toEqual({ statut: "non_connecte" });
    expect(deps.videoALire).not.toHaveBeenCalled();
    expect(deps.adresses).not.toHaveBeenCalled();
  });
  it("Compte sans accès (ou Kit sans vidéo) : refus, aucun jeton créé", async () => {
    const deps = faux({ videoALire: vi.fn(async () => null) });
    await expect(preparerLecture(deps, "kit-test")).resolves.toEqual({ statut: "refuse" });
    expect(deps.adresses).not.toHaveBeenCalled();
  });
  it("nom de Kit invalide : même refus, la base n'est pas interrogée", async () => {
    const deps = faux();
    await expect(preparerLecture(deps, "../x")).resolves.toEqual({ statut: "refuse" });
    expect(deps.videoALire).not.toHaveBeenCalled();
  });
  it("l'accès est revérifié avec le Compte de la session à chaque demande", async () => {
    const deps = faux();
    await preparerLecture(deps, "kit-test");
    await preparerLecture(deps, "kit-test");
    expect(deps.videoALire).toHaveBeenCalledTimes(2);
    expect(deps.videoALire).toHaveBeenCalledWith("TEST_compte", "kit-test");
  });
});

describe("preparerLecture : jeton de courte durée", () => {
  it("signe pour la durée fixée (4 h) à partir de l'instant présent, et renvoie la reprise et les sous-titres", async () => {
    const deps = faux();
    const r = await preparerLecture(deps, "kit-test");
    expect(deps.adresses).toHaveBeenCalledWith("TEST_video_privee", 1_014_400);
    expect(r).toEqual({
      statut: "ok",
      lecture: {
        playlist: "https://TEST.invalid/TEST_video_privee/1014400/playlist.m3u8",
        sousTitres: [
          { langue: "fr", src: "https://TEST.invalid/TEST_video_privee/1014400/fr.vtt" },
          { langue: "en", src: "https://TEST.invalid/TEST_video_privee/1014400/en.vtt" },
        ],
        positionSecondes: 120,
        dureeSecondes: 600,
        expireLe: 1_014_400,
      },
    });
  });
  it("un nouveau jeton à chaque demande (l'instant est relu)", async () => {
    let maintenant = 1_000_000;
    const deps = faux({ maintenantSecondes: vi.fn(() => maintenant) });
    await preparerLecture(deps, "kit-test");
    maintenant += 60;
    await preparerLecture(deps, "kit-test");
    expect(deps.adresses).toHaveBeenNthCalledWith(1, "TEST_video_privee", 1_014_400);
    expect(deps.adresses).toHaveBeenNthCalledWith(2, "TEST_video_privee", 1_014_460);
  });
  it("la reprise ne dépasse jamais la durée", async () => {
    const r = await preparerLecture(faux({ videoALire: vi.fn(async () => video({ position_secondes: 99999 })) }), "kit-test");
    expect(r.statut === "ok" && r.lecture.positionSecondes).toBe(600);
  });
  it("sans bibliothèque réglée (adresses qui lèvent) : « erreur », jamais de jeton, journal sans valeur", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = faux({ adresses: vi.fn(() => { throw new Error("KS_BUNNY_NON_CONFIGURE : TEST_cle"); }) });
    await expect(preparerLecture(deps, "kit-test")).resolves.toEqual({ statut: "erreur" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("TEST_cle");
    spy.mockRestore();
  });
});

describe("enregistrerPosition", () => {
  it("enregistre avec le Compte de la session", async () => {
    const deps = faux();
    await expect(enregistrerPosition(deps, PRODUIT, 45)).resolves.toEqual({ ok: true });
    expect(deps.enregistrerProgression).toHaveBeenCalledWith("TEST_compte", PRODUIT, 45);
  });
  it("non connecté : rien n'est écrit", async () => {
    const deps = faux({ compteId: vi.fn(async () => null) });
    await expect(enregistrerPosition(deps, PRODUIT, 45)).resolves.toEqual({ ok: false, erreur: "non_connecte" });
    expect(deps.enregistrerProgression).not.toHaveBeenCalled();
  });
  it.each([-1, 1.5, 100000, Number.NaN])("position invalide %s : refusée", async (position) => {
    const deps = faux();
    await expect(enregistrerPosition(deps, PRODUIT, position)).resolves.toEqual({ ok: false, erreur: "refuse" });
    expect(deps.enregistrerProgression).not.toHaveBeenCalled();
  });
  it("identifiant de Kit invalide ou sans accès (la base répond faux) : refus", async () => {
    await expect(enregistrerPosition(faux(), "pas-un-uuid", 5)).resolves.toEqual({ ok: false, erreur: "refuse" });
    await expect(enregistrerPosition(faux({ enregistrerProgression: vi.fn(async () => false) }), PRODUIT, 5)).resolves.toEqual({ ok: false, erreur: "refuse" });
  });
});

describe("chapitres", () => {
  const debuts = [0, 60, 180, 300];
  it("chapitre courant : le dernier dont le début est atteint", () => {
    expect(indexChapitre(debuts, 0)).toBe(0);
    expect(indexChapitre(debuts, 59)).toBe(0);
    expect(indexChapitre(debuts, 60)).toBe(1);
    expect(indexChapitre(debuts, 500)).toBe(3);
  });
  it("chapitre courant : indépendant de l'ordre d'affichage de la liste", () => {
    expect(indexChapitre([300, 0, 120], 130)).toBe(2);
    expect(indexChapitre([300, 0, 120], 10)).toBe(1);
    expect(indexChapitre([300, 0, 120], 999)).toBe(0);
  });
  it("chapitres terminés : ceux que la position la plus avancée a dépassés ; tous quand la vidéo est terminée", () => {
    expect(chapitresTermines(debuts, 0, false)).toBe(0);
    expect(chapitresTermines(debuts, 200, false)).toBe(2);
    expect(chapitresTermines(debuts, 310, false)).toBe(3);
    expect(chapitresTermines(debuts, 310, true)).toBe(4);
    expect(chapitresTermines([], 100, true)).toBe(0);
  });
});
