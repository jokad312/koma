import { describe, expect, it, vi } from "vitest";
import { BunnyNonConfigureError } from "@/lib/bunny/config";
import type { LecteurIntervalle } from "@/modules/accueil/heros-mp4";
import * as service from "@/modules/accueil/heros-service";
import type { DependancesHeros, EtatHeros } from "@/modules/accueil/heros-types";

// Faux clients nommés TEST_ : aucun réseau, aucune base.
const ID = "11111111-2222-4333-8444-555555555555";
const AUTRE = "99999999-2222-4333-8444-555555555555";
const AUTEUR = { type: "compte", id: "TEST_admin", role: "admin" } as const;
const ETAT_VIDE: EtatHeros = { produitId: null, videoId: null, videoFichier: null, repliFichier: null, repliAltFr: null, repliAltEn: null };

type Video = { guid: string; title: string; status: number; availableResolutions?: string; encodeProgress?: number };

function boite(type: string, ...contenu: Uint8Array[]): Uint8Array {
  const taille = 8 + contenu.reduce((n, c) => n + c.length, 0);
  const s = new Uint8Array(taille);
  new DataView(s.buffer).setUint32(0, taille);
  s.set(new TextEncoder().encode(type), 4);
  let i = 8;
  for (const c of contenu) {
    s.set(c, i);
    i += c.length;
  }
  return s;
}
const piste = (g: string) => boite("trak", boite("mdia", boite("hdlr", new Uint8Array(8), new TextEncoder().encode(g), new Uint8Array(12))));
const mp4 = (...gestionnaires: string[]): LecteurIntervalle => {
  const f = boite("moov", ...gestionnaires.map(piste));
  return { taille: f.length, lire: async (d, e) => f.slice(d, e) };
};

function faux(opts: { droit?: boolean; heros?: EtatHeros; videos?: Record<string, Video>; lecteur?: LecteurIntervalle | null; ancien?: string | null; configManquante?: boolean } = {}) {
  const videos = opts.videos ?? {};
  const appels: string[] = [];
  const deps: DependancesHeros = {
    exigerDroit: async () => {
      if (opts.droit === false) throw Object.assign(new Error("KS_DROIT_REFUSE"), { code: "KS_DROIT_REFUSE" });
      return { auteur: AUTEUR };
    },
    configBunny: () => {
      if (opts.configManquante) throw new BunnyNonConfigureError(["BUNNY_PUBLIC_API_KEY"]);
      return { bibliothequeId: "42", cle: "TEST_cle-factice", hoteCdn: "vz-test.b-cdn.net" };
    },
    reseau: (async (url: string, init?: RequestInit) => {
      const methode = init?.method ?? "GET";
      appels.push(`${methode} ${url.replace("https://video.bunnycdn.com/library/42/videos", "")}`);
      const id = url.split("/videos/")[1];
      if (methode === "POST") {
        const titre = JSON.parse(String(init?.body)).title as string;
        videos[ID] = { guid: ID, title: titre, status: 0 };
        return new Response(JSON.stringify(videos[ID]), { status: 200 });
      }
      if (methode === "DELETE") {
        delete videos[id];
        return new Response("{}", { status: 200 });
      }
      return videos[id] ? new Response(JSON.stringify(videos[id]), { status: 200 }) : new Response("{}", { status: 404 });
    }) as unknown as typeof fetch,
    maintenant: () => 1_000_000_000_000,
    lireHeros: async () => opts.heros ?? ETAT_VIDE,
    ecrireVedette: vi.fn(async () => ({ erreur: null })),
    ecrireVideo: vi.fn(async () => ({ erreur: null, ancien: opts.ancien ?? null })),
    validerVideo: vi.fn(async () => ({ erreur: null })),
    ecrireRepli: vi.fn(async () => ({ erreur: null, ancien: null })),
    signerEnvoiPhoto: async () => ({ erreur: null, jeton: "TEST_jeton" }),
    lireObjetAttente: async () => ({ erreur: null, octets: null }),
    ecrireObjetPublic: async () => ({ erreur: null }),
    supprimerObjets: vi.fn(async () => ({ erreur: null })),
    ouvrirLecteurMp4: async () => (opts.lecteur === undefined ? null : opts.lecteur),
    invalider: vi.fn(async () => {}),
  };
  return { deps, appels, videos };
}

describe("droits et configuration", () => {
  it("TEST_ sans droit, aucune action n'écrit ni n'appelle Bunny", async () => {
    const { deps, appels } = faux({ droit: false });
    expect(await service.choisirVedette(deps, { produitId: ID })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await service.demanderEnvoiVideo(deps, { type: "video/mp4", taille: 1000 })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await service.verifierVideo(deps)).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await service.supprimerVideo(deps)).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await service.modifierAltRepli(deps, { altFr: "a", altEn: "b" })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(deps.ecrireVedette).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });

  it("TEST_ clé Bunny absente : erreur nommée, rien n'est créé", async () => {
    const { deps, appels } = faux({ configManquante: true });
    expect(await service.demanderEnvoiVideo(deps, { type: "video/mp4", taille: 1000 })).toEqual({ ok: false, erreur: "bunny_non_configure" });
    expect(appels).toHaveLength(0);
  });
});

describe("demanderEnvoiVideo", () => {
  it("TEST_ crée la vidéo à titre préfixé et signe l'envoi sans exposer la clé", async () => {
    const { deps, appels } = faux();
    const r = await service.demanderEnvoiVideo(deps, { type: "video/mp4", taille: 5_000_000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envoi.videoId).toBe(ID);
    expect(r.envoi.titre.startsWith("koma-heros-")).toBe(true);
    expect(r.envoi.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(r)).not.toContain("TEST_cle-factice");
    expect(appels).toEqual(["POST "]);
  });

  it("TEST_ refuse un mauvais type ou une taille excessive avant tout appel à Bunny", async () => {
    const { deps, appels } = faux();
    expect(await service.demanderEnvoiVideo(deps, { type: "application/pdf", taille: 1000 })).toEqual({ ok: false, erreur: "type_invalide" });
    expect(await service.demanderEnvoiVideo(deps, { type: "video/mp4", taille: 201 * 1024 * 1024 })).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(await service.demanderEnvoiVideo(deps, { type: "video/mp4", taille: 0 })).toEqual({ ok: false, erreur: "type_invalide" });
    expect(appels).toHaveLength(0);
  });
});

describe("finaliserVideo, annulerEnvoiVideo, supprimerVideo", () => {
  it("TEST_ enregistre la vidéo créée pour le héros et efface l'ancienne chez Bunny", async () => {
    const { deps, videos } = faux({
      ancien: AUTRE,
      videos: { [ID]: { guid: ID, title: "koma-heros-a", status: 1 }, [AUTRE]: { guid: AUTRE, title: "koma-heros-b", status: 4 } },
    });
    expect(await service.finaliserVideo(deps, { videoId: ID })).toEqual({ ok: true });
    expect(deps.ecrireVideo).toHaveBeenCalledWith({ auteur: AUTEUR, videoId: ID });
    expect(videos[AUTRE]).toBeUndefined();
    expect(videos[ID]).toBeDefined();
    expect(deps.invalider).toHaveBeenCalled();
  });

  it("TEST_ refuse une vidéo qui n'a pas été créée pour le héros", async () => {
    const { deps } = faux({ videos: { [ID]: { guid: ID, title: "autre-video", status: 4 } } });
    expect(await service.finaliserVideo(deps, { videoId: ID })).toEqual({ ok: false, erreur: "video_introuvable" });
    expect(deps.ecrireVideo).not.toHaveBeenCalled();
  });

  it("TEST_ n'efface jamais une vidéo étrangère, même comme « ancienne »", async () => {
    const { deps, videos } = faux({
      ancien: AUTRE,
      videos: { [ID]: { guid: ID, title: "koma-heros-a", status: 1 }, [AUTRE]: { guid: AUTRE, title: "extrait-de-kit", status: 4 } },
    });
    await service.finaliserVideo(deps, { videoId: ID });
    expect(videos[AUTRE]).toBeDefined();
  });

  it("TEST_ annuler : efface la vidéo d'envoi, jamais la vidéo actuelle du héros", async () => {
    const a = faux({ videos: { [ID]: { guid: ID, title: "koma-heros-a", status: 0 } } });
    expect(await service.annulerEnvoiVideo(a.deps, { videoId: ID })).toEqual({ ok: true });
    expect(a.videos[ID]).toBeUndefined();
    const b = faux({ heros: { ...ETAT_VIDE, videoId: ID }, videos: { [ID]: { guid: ID, title: "koma-heros-a", status: 4 } } });
    expect(await service.annulerEnvoiVideo(b.deps, { videoId: ID })).toEqual({ ok: false, erreur: "video_introuvable" });
    expect(b.videos[ID]).toBeDefined();
  });

  it("TEST_ retirer la vidéo l'efface chez Bunny", async () => {
    const { deps, videos } = faux({ ancien: ID, videos: { [ID]: { guid: ID, title: "koma-heros-a", status: 4 } } });
    expect(await service.supprimerVideo(deps)).toEqual({ ok: true });
    expect(videos[ID]).toBeUndefined();
  });
});

describe("verifierVideo", () => {
  const heros: EtatHeros = { ...ETAT_VIDE, videoId: ID };
  const termine = (): Record<string, Video> => ({ [ID]: { guid: ID, title: "koma-heros-a", status: 4, availableResolutions: "360p,720p" } });

  it("TEST_ encodage en cours : rien n'est validé", async () => {
    const { deps } = faux({ heros, videos: { [ID]: { guid: ID, title: "koma-heros-a", status: 3, encodeProgress: 42 } } });
    expect(await service.verifierVideo(deps)).toEqual({ ok: true, video: { etat: "en_cours", progression: 42 } });
    expect(deps.validerVideo).not.toHaveBeenCalled();
  });

  it("TEST_ encodage en échec chez Bunny", async () => {
    const { deps } = faux({ heros, videos: { [ID]: { guid: ID, title: "koma-heros-a", status: 5 } } });
    expect(await service.verifierVideo(deps)).toEqual({ ok: false, erreur: "encodage_echec" });
  });

  it("TEST_ MP4 inaccessible (MP4 Fallback éteint, référent refusé) : rien n'est validé", async () => {
    const { deps } = faux({ heros, videos: termine(), lecteur: null });
    expect(await service.verifierVideo(deps)).toEqual({ ok: false, erreur: "mp4_indisponible" });
    expect(deps.validerVideo).not.toHaveBeenCalled();
  });

  it("TEST_ MP4 avec piste audio : refusé, rien n'est validé", async () => {
    const { deps } = faux({ heros, videos: termine(), lecteur: mp4("vide", "soun") });
    expect(await service.verifierVideo(deps)).toEqual({ ok: false, erreur: "video_avec_audio" });
    expect(deps.validerVideo).not.toHaveBeenCalled();
  });

  it("TEST_ MP4 sans piste vidéo ou illisible : refusé", async () => {
    expect(await service.verifierVideo(faux({ heros, videos: termine(), lecteur: mp4("soun") }).deps)).toEqual({ ok: false, erreur: "video_illisible" });
    expect(await service.verifierVideo(faux({ heros, videos: termine(), lecteur: { taille: 50, lire: async () => null } }).deps)).toEqual({ ok: false, erreur: "video_illisible" });
  });

  it("TEST_ encodage terminé et MP4 sans audio : fichier 720p validé", async () => {
    const { deps } = faux({ heros, videos: termine(), lecteur: mp4("vide") });
    expect(await service.verifierVideo(deps)).toEqual({ ok: true, video: { etat: "prete" } });
    expect(deps.validerVideo).toHaveBeenCalledWith({ auteur: AUTEUR, videoId: ID, fichier: "play_720p.mp4" });
  });

  it("TEST_ déjà validée : aucun appel à Bunny", async () => {
    const { deps, appels } = faux({ heros: { ...heros, videoFichier: "play_720p.mp4" } });
    expect(await service.verifierVideo(deps)).toEqual({ ok: true, video: { etat: "prete" } });
    expect(appels).toHaveLength(0);
  });

  it("TEST_ aucune vidéo enregistrée ou vidéo disparue", async () => {
    expect(await service.verifierVideo(faux().deps)).toEqual({ ok: false, erreur: "video_introuvable" });
    expect(await service.verifierVideo(faux({ heros }).deps)).toEqual({ ok: false, erreur: "video_introuvable" });
  });
});

describe("photo de repli", () => {
  it("TEST_ choisit un objet du dossier heros et signe l'envoi", async () => {
    const r = await service.demanderEnvoiRepli(faux().deps, { type: "image/jpeg", taille: 1000, altFr: "Un", altEn: "One" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.objet).toMatch(/^heros\/[0-9a-f-]{36}\.jpg$/);
  });

  it("TEST_ refuse un format, une taille ou un texte alternatif invalides avant de signer", async () => {
    const { deps } = faux();
    expect(await service.demanderEnvoiRepli(deps, { type: "image/gif", taille: 1000, altFr: "a", altEn: "b" })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await service.demanderEnvoiRepli(deps, { type: "image/png", taille: 99 * 1024 * 1024, altFr: "a", altEn: "b" })).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(await service.demanderEnvoiRepli(deps, { type: "image/png", taille: 1000, altFr: "", altEn: "b" })).toEqual({ ok: false, erreur: "alt_invalide" });
  });

  it("TEST_ finaliser n'accepte qu'un objet du dossier heros", async () => {
    const { deps } = faux();
    expect(await service.finaliserRepli(deps, { objet: `${ID}/${AUTRE}.jpg`, altFr: "a", altEn: "b" })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await service.finaliserRepli(deps, { objet: "heros/../x.jpg", altFr: "a", altEn: "b" })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(deps.ecrireRepli).not.toHaveBeenCalled();
  });

  it("TEST_ finaliser : contenu qui n'est pas une image refusé, original d'attente effacé", async () => {
    const { deps } = faux();
    deps.lireObjetAttente = async () => ({ erreur: null, octets: new TextEncoder().encode("pas une image") });
    expect(await service.finaliserRepli(deps, { objet: `heros/${ID}.jpg`, altFr: "a", altEn: "b" })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(deps.ecrireRepli).not.toHaveBeenCalled();
    expect(deps.supprimerObjets).toHaveBeenCalledWith({ bucket: "galerie-attente", objets: [`heros/${ID}.jpg`] });
  });

  it("TEST_ modifier les textes seuls : appelle l'écriture sans fichier", async () => {
    const { deps } = faux();
    expect(await service.modifierAltRepli(deps, { altFr: " Un ", altEn: "One" })).toEqual({ ok: true });
    expect(deps.ecrireRepli).toHaveBeenCalledWith({ auteur: AUTEUR, fichier: null, altFr: "Un", altEn: "One" });
  });
});

describe("choisirVedette", () => {
  it("TEST_ identifiant invalide refusé ; null retire la vedette", async () => {
    const { deps } = faux();
    expect(await service.choisirVedette(deps, { produitId: "pas-un-id" })).toEqual({ ok: false, erreur: "vedette_invalide" });
    expect(await service.choisirVedette(deps, { produitId: null })).toEqual({ ok: true });
    expect(deps.ecrireVedette).toHaveBeenCalledWith({ auteur: AUTEUR, produitId: null });
  });

  it("TEST_ un refus de la base devient un code d'interface", async () => {
    const { deps } = faux();
    deps.ecrireVedette = async () => ({ erreur: "KS_VEDETTE_INVALIDE" });
    expect(await service.choisirVedette(deps, { produitId: ID })).toEqual({ ok: false, erreur: "vedette_invalide" });
  });
});
