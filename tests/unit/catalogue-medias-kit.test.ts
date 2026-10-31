import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ajouterChapitreKit,
  annulerEnvoiSousTitres,
  annulerEnvoiVideoKit,
  demanderEnvoiSousTitres,
  demanderEnvoiVideoKit,
  deplacerChapitreKit,
  finaliserSousTitres,
  modifierChapitreKit,
  retirerExtraitKit,
  supprimerChapitreKit,
  supprimerSousTitres,
  supprimerVideoKit,
  titreVideoKit,
  verifierVideoKit,
} from "@/modules/catalogue/medias-kit";
import { creerTestDependancesMediasKit, TEST_ADMIN_ID, TEST_KIT_ID } from "../doubles/TEST_dependances-catalogue";

// Faux clients nommés TEST_ : aucun réseau réel, aucune base (règle 13).
const AUTEUR = { type: "compte", id: TEST_ADMIN_ID, role: "admin" };
const V_CREE = "00000000-0000-4000-8000-0000000000e1";
const V_ANCIEN = "00000000-0000-4000-8000-0000000000e2";
const V_AUTRE = "00000000-0000-4000-8000-0000000000e3";
const CHAPITRE = "00000000-0000-4000-8000-0000000000c1";
const MO = 1024 * 1024;
const TITRE = `KIT_${TEST_KIT_ID}`;
const TITRE_EXTRAIT = `KIT_EXTRAIT_${TEST_KIT_ID}`;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const envoi = (partiel: Partial<Parameters<typeof demanderEnvoiVideoKit>[1]> = {}) => ({
  produitId: TEST_KIT_ID,
  genre: "complete" as const,
  type: "video/mp4",
  taille: 800 * MO,
  ...partiel,
});

describe("titres Bunny", () => {
  it("aucun nom de franchise : seulement l'identifiant du Kit", () => {
    expect(titreVideoKit("complete", TEST_KIT_ID)).toBe(TITRE);
    expect(titreVideoKit("extrait", TEST_KIT_ID)).toBe(TITRE_EXTRAIT);
  });
});

describe("demanderEnvoiVideoKit", () => {
  it("vidéo complète de 800 Mo : créée dans la bibliothèque privée, signature TUS rendue, jamais la clé", async () => {
    const { deps, appels } = creerTestDependancesMediasKit();
    const r = await demanderEnvoiVideoKit(deps, envoi());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(appels.ordre[0]).toBe("droit:produits.modifier");
    expect(appels.bunny).toEqual(["POST 111/videos"]);
    expect(r.envoi).toMatchObject({ videoId: V_CREE, bibliothequeId: "111", titre: TITRE, adresse: "https://video.bunnycdn.com/tusupload" });
    expect(JSON.stringify(r)).not.toContain("TEST_cle-privee");
  });

  it("extrait : bibliothèque publique, 200 Mo au plus, vidéo complète exigée", async () => {
    const sans = creerTestDependancesMediasKit();
    expect(await demanderEnvoiVideoKit(sans.deps, envoi({ genre: "extrait", taille: 10 * MO }))).toEqual({ ok: false, erreur: "video_absente" });
    expect(sans.appels.bunny).toEqual([]);
    const avec = creerTestDependancesMediasKit({ videoKit: { bunnyIdPrive: V_ANCIEN, extraitId: null, dureeSecondes: 600 } });
    const r = await demanderEnvoiVideoKit(avec.deps, envoi({ genre: "extrait", taille: 200 * MO }));
    expect(r.ok && r.envoi).toMatchObject({ bibliothequeId: "222", titre: TITRE_EXTRAIT });
    expect(await demanderEnvoiVideoKit(avec.deps, envoi({ genre: "extrait", taille: 200 * MO + 1 }))).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
  });

  it.each([["video/avi"], ["image/png"], [""]])("type %s refusé avant l'envoi : format_invalide, Bunny jamais appelé", async (type) => {
    const { deps, appels } = creerTestDependancesMediasKit();
    expect(await demanderEnvoiVideoKit(deps, envoi({ type }))).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.bunny).toEqual([]);
  });

  it("au-delà de 4 Go : fichier_trop_lourd ; 4 Go exactement accepté", async () => {
    const { deps } = creerTestDependancesMediasKit();
    expect(await demanderEnvoiVideoKit(deps, envoi({ taille: 4 * 1024 * MO + 1 }))).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect((await demanderEnvoiVideoKit(deps, envoi({ taille: 4 * 1024 * MO }))).ok).toBe(true);
  });

  it("produit qui n'est pas un Kit, produit inconnu, identifiant mal formé", async () => {
    expect(await demanderEnvoiVideoKit(creerTestDependancesMediasKit({ familleProduit: "cosplay" }).deps, envoi())).toEqual({ ok: false, erreur: "famille_invalide" });
    expect(await demanderEnvoiVideoKit(creerTestDependancesMediasKit({ familleProduit: null }).deps, envoi())).toEqual({ ok: false, erreur: "produit_introuvable" });
    expect(await demanderEnvoiVideoKit(creerTestDependancesMediasKit().deps, envoi({ produitId: "x" }))).toEqual({ ok: false, erreur: "produit_introuvable" });
  });

  it("Assistant ou Compte simple : non_autorise, rien n'est créé chez Bunny", async () => {
    for (const droit of ["KS_DROIT_REFUSE", "KS_NON_CONNECTE"] as const) {
      const { deps, appels } = creerTestDependancesMediasKit({ droit });
      expect(await demanderEnvoiVideoKit(deps, envoi())).toEqual({ ok: false, erreur: "non_autorise" });
      expect(appels.bunny).toEqual([]);
    }
  });

  it("bibliothèque privée non configurée ou Bunny indisponible", async () => {
    expect(await demanderEnvoiVideoKit(creerTestDependancesMediasKit({ configPriveeManquante: true }).deps, envoi())).toEqual({ ok: false, erreur: "bunny_non_configure" });
    expect(await demanderEnvoiVideoKit(creerTestDependancesMediasKit({ creationEnEchec: true }).deps, envoi())).toEqual({ ok: false, erreur: "bunny_indisponible" });
  });
});

describe("verifierVideoKit", () => {
  const verif = (partiel: Partial<Parameters<typeof verifierVideoKit>[1]> = {}) => ({ produitId: TEST_KIT_ID, genre: "complete" as const, videoId: V_CREE, ...partiel });

  it("encodage en cours : rien n'est enregistré, progression lue chez Bunny", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ videos: { [V_CREE]: { guid: V_CREE, title: TITRE, status: 3, encodeProgress: 42.4 } } });
    expect(await verifierVideoKit(deps, verif())).toEqual({ ok: true, video: { etat: "en_cours", progression: 42 } });
    expect(appels.videosEcrites).toEqual([]);
  });

  it("encodage terminé : enregistrée avec la durée de Bunny, puis l'ancienne vidéo effacée APRÈS la base", async () => {
    const { deps, appels, videos } = creerTestDependancesMediasKit({
      videos: { [V_CREE]: { guid: V_CREE, title: TITRE, status: 4, length: 754 }, [V_ANCIEN]: { guid: V_ANCIEN, title: TITRE, status: 4, length: 300 } },
      ancienVideo: V_ANCIEN,
    });
    expect(await verifierVideoKit(deps, verif())).toEqual({ ok: true, video: { etat: "prete" } });
    expect(appels.videosEcrites).toEqual([{ auteur: AUTEUR, produitId: TEST_KIT_ID, bunnyId: V_CREE, duree: 754 }]);
    const ecriture = appels.ordre.indexOf("ecrireVideo");
    expect(appels.ordre.lastIndexOf("bunny:DELETE")).toBeGreaterThan(ecriture);
    expect(appels.bunny).toContain(`DELETE 111/videos/${V_ANCIEN}`);
    expect(videos[V_ANCIEN]).toBeUndefined();
    expect(appels.ordre.at(-1)).toBe("invalidation");
  });

  it("effacement de l'ancienne vidéo en échec : journalisé, non bloquant", async () => {
    const { deps } = creerTestDependancesMediasKit({ videos: { [V_CREE]: { guid: V_CREE, title: TITRE, status: 4, length: 60 } }, ancienVideo: V_ANCIEN });
    // L'ancienne vidéo est introuvable chez Bunny : rien n'est effacé, la nouvelle reste enregistrée.
    expect(await verifierVideoKit(deps, verif())).toEqual({ ok: true, video: { etat: "prete" } });
  });

  it("encodage en échec : video_echec, rien d'enregistré, vidéo supprimée chez Bunny", async () => {
    const { deps, appels, videos } = creerTestDependancesMediasKit({ videos: { [V_CREE]: { guid: V_CREE, title: TITRE, status: 5 } } });
    expect(await verifierVideoKit(deps, verif())).toEqual({ ok: false, erreur: "video_echec" });
    expect(appels.videosEcrites).toEqual([]);
    expect(videos[V_CREE]).toBeUndefined();
  });

  it("une vidéo d'un autre titre n'est ni enregistrée ni effacée", async () => {
    const { deps, appels, videos } = creerTestDependancesMediasKit({ videos: { [V_AUTRE]: { guid: V_AUTRE, title: "autre-video", status: 5 } } });
    expect(await verifierVideoKit(deps, verif({ videoId: V_AUTRE }))).toEqual({ ok: false, erreur: "video_introuvable" });
    expect(appels.videosEcrites).toEqual([]);
    expect(videos[V_AUTRE]).toBeDefined();
  });

  it("durée inconnue chez Bunny : rien d'enregistré, la vidéo est gardée", async () => {
    const { deps, appels, videos } = creerTestDependancesMediasKit({ videos: { [V_CREE]: { guid: V_CREE, title: TITRE, status: 4 } } });
    expect(await verifierVideoKit(deps, verif())).toEqual({ ok: false, erreur: "duree_invalide" });
    expect(appels.videosEcrites).toEqual([]);
    expect(videos[V_CREE]).toBeDefined();
  });

  it("chapitres hors de la nouvelle durée : refus de la base, nouvelle vidéo effacée", async () => {
    const { deps, videos } = creerTestDependancesMediasKit({
      videos: { [V_CREE]: { guid: V_CREE, title: TITRE, status: 4, length: 30 } },
      erreurVideo: "KS_CHAPITRES_HORS_DUREE",
    });
    expect(await verifierVideoKit(deps, verif())).toEqual({ ok: false, erreur: "chapitres_hors_duree" });
    expect(videos[V_CREE]).toBeUndefined();
  });

  it("erreur inconnue de la base : la vidéo est gardée (résultat incertain)", async () => {
    const { deps, videos } = creerTestDependancesMediasKit({ videos: { [V_CREE]: { guid: V_CREE, title: TITRE, status: 4, length: 30 } }, erreurVideo: "connexion perdue" });
    expect(await verifierVideoKit(deps, verif())).toEqual({ ok: false, erreur: "generique" });
    expect(videos[V_CREE]).toBeDefined();
  });

  it("déjà enregistrée : prête, sans nouvelle écriture", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ videoKit: { bunnyIdPrive: V_CREE, extraitId: null, dureeSecondes: 60 } });
    expect(await verifierVideoKit(deps, verif())).toEqual({ ok: true, video: { etat: "prete" } });
    expect(appels.videosEcrites).toEqual([]);
    expect(appels.bunny).toEqual([]);
  });

  it("extrait terminé : enregistré dans video_kit (bibliothèque publique), l'ancien extrait effacé ensuite", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({
      videos: { [V_CREE]: { guid: V_CREE, title: TITRE_EXTRAIT, status: 4, length: 20 }, [V_ANCIEN]: { guid: V_ANCIEN, title: TITRE_EXTRAIT, status: 4, length: 20 } },
      videoKit: { bunnyIdPrive: V_AUTRE, extraitId: V_ANCIEN, dureeSecondes: 600 },
      ancienExtrait: V_ANCIEN,
    });
    expect(await verifierVideoKit(deps, verif({ genre: "extrait" }))).toEqual({ ok: true, video: { etat: "prete" } });
    expect(appels.extraitsEcrits).toEqual([{ auteur: AUTEUR, produitId: TEST_KIT_ID, extraitId: V_CREE }]);
    expect(appels.bunny).toContain(`DELETE 222/videos/${V_ANCIEN}`);
  });

  it("sans droit : non_autorise, Bunny jamais lu", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ droit: "KS_DROIT_REFUSE" });
    expect(await verifierVideoKit(deps, verif())).toEqual({ ok: false, erreur: "non_autorise" });
    expect(appels.bunny).toEqual([]);
  });
});

describe("annulerEnvoiVideoKit, supprimerVideoKit, retirerExtraitKit", () => {
  it("annulation : la vidéo créée est effacée chez Bunny, jamais la vidéo enregistrée", async () => {
    const a = creerTestDependancesMediasKit({ videos: { [V_CREE]: { guid: V_CREE, title: TITRE, status: 1 } } });
    expect(await annulerEnvoiVideoKit(a.deps, { produitId: TEST_KIT_ID, genre: "complete", videoId: V_CREE })).toEqual({ ok: true });
    expect(a.videos[V_CREE]).toBeUndefined();
    const b = creerTestDependancesMediasKit({
      videos: { [V_ANCIEN]: { guid: V_ANCIEN, title: TITRE, status: 4 } },
      videoKit: { bunnyIdPrive: V_ANCIEN, extraitId: null, dureeSecondes: 60 },
    });
    expect(await annulerEnvoiVideoKit(b.deps, { produitId: TEST_KIT_ID, genre: "complete", videoId: V_ANCIEN })).toEqual({ ok: false, erreur: "video_introuvable" });
    expect(b.videos[V_ANCIEN]).toBeDefined();
  });

  it("retrait : la base d'abord, puis la vidéo privée et l'extrait effacés chez Bunny", async () => {
    const { deps, appels, videos } = creerTestDependancesMediasKit({
      videos: { [V_ANCIEN]: { guid: V_ANCIEN, title: TITRE, status: 4 }, [V_AUTRE]: { guid: V_AUTRE, title: TITRE_EXTRAIT, status: 4 } },
      videoKit: { bunnyIdPrive: V_ANCIEN, extraitId: V_AUTRE, dureeSecondes: 60 },
    });
    expect(await supprimerVideoKit(deps, { produitId: TEST_KIT_ID })).toEqual({ ok: true });
    expect(appels.ordre.indexOf("supprimerVideo")).toBeLessThan(appels.ordre.indexOf("bunny:DELETE"));
    expect(videos).toEqual({});
  });

  it("Kit publié : la base refuse le retrait (publication_incomplete), rien n'est effacé chez Bunny", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ erreurSupprimerVideo: "KS_PUBLICATION_INCOMPLETE" });
    expect(await supprimerVideoKit(deps, { produitId: TEST_KIT_ID })).toEqual({ ok: false, erreur: "publication_incomplete" });
    expect(appels.bunny).toEqual([]);
  });

  it("retirer l'extrait : enregistré à nul, puis effacé chez Bunny", async () => {
    const { deps, appels, videos } = creerTestDependancesMediasKit({ videos: { [V_AUTRE]: { guid: V_AUTRE, title: TITRE_EXTRAIT, status: 4 } }, ancienExtrait: V_AUTRE });
    expect(await retirerExtraitKit(deps, { produitId: TEST_KIT_ID })).toEqual({ ok: true });
    expect(appels.extraitsEcrits[0].extraitId).toBeNull();
    expect(videos[V_AUTRE]).toBeUndefined();
  });
});

describe("chapitres", () => {
  const chapitre = (partiel: Partial<{ titreFr: string; titreEn: string; debut: string }> = {}) => ({
    produitId: TEST_KIT_ID,
    titreFr: " Coupe ",
    titreEn: "Cutting",
    debut: "2:30",
    ...partiel,
  });

  it("ajout : titres rognés, instant mm:ss ou h:mm:ss converti en secondes", async () => {
    const { deps, appels } = creerTestDependancesMediasKit();
    expect(await ajouterChapitreKit(deps, chapitre())).toEqual({ ok: true, id: "TEST_chapitre-0001" });
    await ajouterChapitreKit(deps, chapitre({ debut: "1:02:03" }));
    expect(appels.chapitres).toEqual([
      { auteur: AUTEUR, produitId: TEST_KIT_ID, titreFr: "Coupe", titreEn: "Cutting", debut: 150 },
      { auteur: AUTEUR, produitId: TEST_KIT_ID, titreFr: "Coupe", titreEn: "Cutting", debut: 3723 },
    ]);
  });

  it.each([
    [{ titreFr: "  " }, "titre_invalide", "titre_fr"],
    [{ titreEn: "x".repeat(121) }, "titre_invalide", "titre_en"],
    [{ debut: "150" }, "instant_invalide", "debut"],
    [{ debut: "2:75" }, "instant_invalide", "debut"],
    [{ debut: "abc" }, "instant_invalide", "debut"],
  ])("saisie refusée avant la base %#", async (partiel, erreur, champ) => {
    const { deps, appels } = creerTestDependancesMediasKit();
    expect(await ajouterChapitreKit(deps, chapitre(partiel))).toEqual({ ok: false, erreur, champ });
    expect(appels.chapitres).toEqual([]);
  });

  it.each([
    ["KS_CHAPITRE_INVALIDE", { erreur: "chapitre_invalide", champ: "debut" }],
    ["KS_CHAPITRE_DEBUT_PRIS", { erreur: "chapitre_debut_pris", champ: "debut" }],
    ["KS_VIDEO_ABSENTE", { erreur: "video_absente" }],
    ["KS_CHAPITRES_LIMITE", { erreur: "chapitres_limite" }],
    ["KS_DROIT_REFUSE", { erreur: "non_autorise" }],
  ])("refus de la base %s", async (code, attendu) => {
    const { deps, appels } = creerTestDependancesMediasKit({ erreurChapitre: code });
    expect(await ajouterChapitreKit(deps, chapitre({ debut: "12:00" }))).toEqual({ ok: false, ...attendu });
    expect(appels.invalidations).toBe(0);
  });

  it("modifier, déplacer, supprimer : droit, identifiant, puis la base", async () => {
    const { deps, appels } = creerTestDependancesMediasKit();
    expect(await modifierChapitreKit(deps, { chapitreId: CHAPITRE, titreFr: "A", titreEn: "B", debut: "0:10" })).toEqual({ ok: true });
    expect(await deplacerChapitreKit(deps, { chapitreId: CHAPITRE, sens: "haut" })).toEqual({ ok: true });
    expect(await deplacerChapitreKit(deps, { chapitreId: CHAPITRE, sens: "gauche" })).toEqual({ ok: false, erreur: "generique" });
    expect(await supprimerChapitreKit(deps, { chapitreId: CHAPITRE })).toEqual({ ok: true });
    expect(await supprimerChapitreKit(deps, { chapitreId: "x" })).toEqual({ ok: false, erreur: "chapitre_introuvable" });
    expect(appels.chapitres).toEqual([
      { auteur: AUTEUR, chapitreId: CHAPITRE, titreFr: "A", titreEn: "B", debut: 10 },
      { auteur: AUTEUR, chapitreId: CHAPITRE, sens: "haut" },
      { auteur: AUTEUR, chapitreId: CHAPITRE },
    ]);
  });

  it("sans droit : rien n'est écrit", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ droit: "KS_DROIT_REFUSE" });
    expect(await ajouterChapitreKit(deps, chapitre())).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await supprimerChapitreKit(deps, { chapitreId: CHAPITRE })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(appels.chapitres).toEqual([]);
  });
});

describe("sous-titres", () => {
  const OBJET = `${TEST_KIT_ID}/sous-titres/11111111-1111-4111-8111-111111111111.vtt`;
  const VTT = new TextEncoder().encode("WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nBonjour\n");
  const SANS_ENTETE = new TextEncoder().encode("00:00:01.000 --> 00:00:04.000\nBonjour\n");

  it("autorisation : .vtt, 1 Mo au plus, objet choisi par le serveur dans kits-private/<produit>/sous-titres/", async () => {
    const { deps, appels } = creerTestDependancesMediasKit();
    const r = await demanderEnvoiSousTitres(deps, { produitId: TEST_KIT_ID, langue: "fr", nomFichier: "fr.vtt", taille: 100 });
    expect(r).toMatchObject({ ok: true, jeton: "TEST_jeton-vtt", contentType: "text/vtt" });
    expect(appels.signatures[0]).toMatch(new RegExp(`^${TEST_KIT_ID}/sous-titres/[0-9a-f-]{36}[.]vtt$`));
    expect(await demanderEnvoiSousTitres(deps, { produitId: TEST_KIT_ID, langue: "fr", nomFichier: "fr.srt", taille: 100 })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(await demanderEnvoiSousTitres(deps, { produitId: TEST_KIT_ID, langue: "fr", nomFichier: "fr.vtt", taille: 1_048_577 })).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(await demanderEnvoiSousTitres(deps, { produitId: TEST_KIT_ID, langue: "de", nomFichier: "de.vtt", taille: 100 })).toEqual({ ok: false, erreur: "langue_invalide" });
  });

  it("finalisation valide : contenu vérifié, objet déplacé, enregistré, l'ancien effacé après la base", async () => {
    const ancien = `${TEST_KIT_ID}/sous-titres/22222222-2222-4222-8222-222222222222.vtt`;
    const { deps, appels } = creerTestDependancesMediasKit({ objetKit: { trouve: true, taille: VTT.length, debut: VTT }, ancienCheminSousTitres: ancien });
    expect(await finaliserSousTitres(deps, { produitId: TEST_KIT_ID, langue: "fr", objet: OBJET, taille: VTT.length })).toEqual({ ok: true });
    const nouveau = appels.deplacements[0].vers;
    expect(appels.deplacements[0].de).toBe(OBJET);
    expect(appels.sousTitres).toEqual([{ auteur: AUTEUR, produitId: TEST_KIT_ID, langue: "fr", taille: VTT.length, chemin: nouveau }]);
    expect(appels.suppressionsObjets).toEqual([[ancien]]);
    expect(appels.ordre.indexOf("ecrireSousTitres")).toBeLessThan(appels.ordre.indexOf("supprimerObjets"));
  });

  it("sans WEBVTT : format_invalide, objet effacé, rien d'enregistré", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ objetKit: { trouve: true, taille: SANS_ENTETE.length, debut: SANS_ENTETE } });
    expect(await finaliserSousTitres(deps, { produitId: TEST_KIT_ID, langue: "fr", objet: OBJET, taille: SANS_ENTETE.length })).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.sousTitres).toEqual([]);
    expect(appels.suppressionsObjets).toEqual([[OBJET]]);
  });

  it("objet d'un autre Kit ou déjà enregistré : jamais lu ni effacé", async () => {
    const autre = creerTestDependancesMediasKit();
    expect(await finaliserSousTitres(autre.deps, { produitId: TEST_KIT_ID, langue: "fr", objet: OBJET.replace(TEST_KIT_ID, "00000000-0000-4000-8000-0000000000ff"), taille: 10 })).toEqual({
      ok: false,
      erreur: "format_invalide",
    });
    const enregistre = creerTestDependancesMediasKit({ cheminEnregistre: true });
    expect(await finaliserSousTitres(enregistre.deps, { produitId: TEST_KIT_ID, langue: "fr", objet: OBJET, taille: 10 })).toEqual({ ok: false, erreur: "fichier_deja_enregistre" });
    expect(await annulerEnvoiSousTitres(enregistre.deps, { produitId: TEST_KIT_ID, objet: OBJET })).toEqual({ ok: false, erreur: "fichier_deja_enregistre" });
    expect([...autre.appels.suppressionsObjets, ...enregistre.appels.suppressionsObjets]).toEqual([]);
  });

  it("refus connu de la base (KS_) : l'objet déplacé est effacé ; erreur non KS_ (réseau, délai) : il est gardé", async () => {
    const refus = creerTestDependancesMediasKit({ objetKit: { trouve: true, taille: VTT.length, debut: VTT }, erreurSousTitres: "KS_TAILLE_FICHIER_INVALIDE" });
    expect(await finaliserSousTitres(refus.deps, { produitId: TEST_KIT_ID, langue: "fr", objet: OBJET, taille: VTT.length })).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(refus.appels.suppressionsObjets).toEqual([[refus.appels.deplacements[0].vers]]);
    const reseau = creerTestDependancesMediasKit({ objetKit: { trouve: true, taille: VTT.length, debut: VTT }, erreurSousTitres: "fetch failed: délai dépassé" });
    expect(await finaliserSousTitres(reseau.deps, { produitId: TEST_KIT_ID, langue: "fr", objet: OBJET, taille: VTT.length })).toEqual({ ok: false, erreur: "generique" });
    expect(reseau.appels.suppressionsObjets).toEqual([]);
  });

  it("base muette (exception) : l'objet déplacé est gardé", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ objetKit: { trouve: true, taille: VTT.length, debut: VTT }, leveSousTitres: true });
    expect(await finaliserSousTitres(deps, { produitId: TEST_KIT_ID, langue: "fr", objet: OBJET, taille: VTT.length })).toEqual({ ok: false, erreur: "generique" });
    expect(appels.suppressionsObjets).toEqual([]);
  });

  it("suppression : la base d'abord ; sous-titres FR d'un Kit publié refusés", async () => {
    const ok = creerTestDependancesMediasKit();
    expect(await supprimerSousTitres(ok.deps, { produitId: TEST_KIT_ID, langue: "en" })).toEqual({ ok: true });
    expect(ok.appels.ordre.slice(1)).toEqual(["supprimerSousTitres", "supprimerObjets", "invalidation"]);
    const refuse = creerTestDependancesMediasKit({ erreurSupprimerSousTitres: "KS_PUBLICATION_INCOMPLETE" });
    expect(await supprimerSousTitres(refuse.deps, { produitId: TEST_KIT_ID, langue: "fr" })).toEqual({ ok: false, erreur: "publication_incomplete" });
    expect(refuse.appels.suppressionsObjets).toEqual([]);
  });

  it("sans droit : non_autorise, rien n'est signé", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ droit: "KS_DROIT_REFUSE" });
    expect(await demanderEnvoiSousTitres(deps, { produitId: TEST_KIT_ID, langue: "fr", nomFichier: "fr.vtt", taille: 100 })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(appels.signatures).toEqual([]);
  });
});
