import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADRESSES, cheminPublic } from "@/i18n/adresses";
import { RUBRIQUES } from "@/components/layout/rubriques";
import { deposerSousTitresBunny, supprimerSousTitresBunny } from "@/lib/bunny/api";
import { videoJsonLd } from "@/lib/seo/jsonld";
import { analyserRequete, analyserRequeteFamille, compterFiltres, pourFamille, sansCurseur, serialiserRequete } from "@/modules/catalogue/adresse";
import { analyserAdresseFiche } from "@/modules/catalogue/existence";
import { adressesExtrait } from "@/modules/catalogue/extrait";
import { definirExtraitSansParole, deposerSousTitresExtrait, supprimerSousTitresExtrait } from "@/modules/catalogue/medias-kit";
import { manquesPublication } from "@/modules/catalogue/publication";
import { creerTestDependancesMediasKit, TEST_KIT_COMPLET, TEST_KIT_ID } from "../doubles/TEST_dependances-catalogue";

// Story 3.3 : catalogue Kits (adresse, niveau, rubrique, proxy), fiche (adresses de l'extrait, VideoObject) et sous-titres de l'extrait.
// Faux clients nommés TEST_ : aucun réseau réel, aucune base (règle 13).

const EXTRAIT = "00000000-0000-4000-8000-0000000000e9";
const PRIVE = "00000000-0000-4000-8000-0000000000e8";
const VTT = new TextEncoder().encode("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nTEST_réplique\n");

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("adresse du catalogue Kits", () => {
  it("lit le niveau connu, ignore un niveau inconnu", () => {
    expect(analyserRequete({ niveau: "debutant" }).niveau).toBe("debutant");
    expect(analyserRequete({ niveau: "xyz" }).niveau).toBeNull();
  });

  it("le niveau compte comme filtre et se sérialise avant le tri", () => {
    const p = analyserRequete({ niveau: "avance", tri: "prix_asc" });
    expect(compterFiltres(p)).toBe(1);
    expect(serialiserRequete(sansCurseur(p))).toBe("niveau=avance&tri=prix_asc");
  });

  it("pourFamille : niveau pour les Kits seulement, disponibilité pour le physique seulement", () => {
    const brut = { niveau: "intermediaire", dispo: "en_stock" };
    expect(analyserRequeteFamille(brut, "kit")).toMatchObject({ niveau: "intermediaire", dispo: null });
    expect(analyserRequeteFamille(brut, "cosplay")).toMatchObject({ niveau: null, dispo: "en_stock" });
    expect(pourFamille(analyserRequete(brut), "accessoire").niveau).toBeNull();
  });

  it("/kits a la même adresse en français et en anglais ; la rubrique Kits existe", () => {
    expect(ADRESSES).toContainEqual({ interne: "/kits", fr: "/kits", en: "/kits" });
    expect(cheminPublic("en", "/kits/x")).toBe("/kits/x");
    expect(RUBRIQUES.map((r) => r.cle)).toContain("kits");
  });

  it("le proxy reconnaît /<langue>/kits/<slug> comme fiche de Kit", () => {
    expect(analyserAdresseFiche("/fr/kits/absent")).toEqual({ locale: "fr", famille: "kit", segment: "absent" });
    expect(analyserAdresseFiche("/en/kits/mon-kit")).toEqual({ locale: "en", famille: "kit", segment: "mon-kit" });
    expect(analyserAdresseFiche("/fr/kits")).toBeNull();
  });
});

describe("extrait public", () => {
  it("adresses du CDN public : playlist, vignette et sous-titres", () => {
    const a = adressesExtrait("vz-test.b-cdn.net", EXTRAIT);
    expect(a?.playlist).toBe(`https://vz-test.b-cdn.net/${EXTRAIT}/playlist.m3u8`);
    expect(a?.vignette).toBe(`https://vz-test.b-cdn.net/${EXTRAIT}/thumbnail.jpg`);
    expect(a?.sousTitres("fr")).toBe(`https://vz-test.b-cdn.net/${EXTRAIT}/captions/fr.vtt`);
  });

  it("sans hôte CDN ou avec un identifiant mal formé : aucun lecteur", () => {
    expect(adressesExtrait(null, EXTRAIT)).toBeNull();
    expect(adressesExtrait("vz-test.b-cdn.net", "../x")).toBeNull();
  });

  it("VideoObject : nom, description, vignette, date d'envoi, contenu ; ni note ni avis", () => {
    const v = videoJsonLd({ nom: "TEST_Extrait", description: "TEST_d", vignette: "https://x/t.jpg", dateEnvoi: "2026-10-31T10:00:00.000Z", contenu: "https://x/p.m3u8", langue: "fr" });
    expect(v).toMatchObject({ "@type": "VideoObject", name: "TEST_Extrait", thumbnailUrl: ["https://x/t.jpg"], uploadDate: "2026-10-31T10:00:00.000Z", contentUrl: "https://x/p.m3u8" });
    expect(JSON.stringify(v)).not.toMatch(/aggregateRating|review/);
  });
});

describe("manques : sous-titres de l'extrait", () => {
  it("extrait parlé sans FR : sous_titres_extrait_fr en dernier", () => {
    expect(manquesPublication({ ...TEST_KIT_COMPLET, extraitSansSousTitresFr: true })).toEqual(["sous_titres_extrait_fr"]);
    expect(manquesPublication({ ...TEST_KIT_COMPLET, extraitSansSousTitresFr: false })).toEqual([]);
  });
});

describe("API captions de Bunny", () => {
  it("dépose en base64 par POST et supprime par DELETE à la même adresse", async () => {
    const appels: Array<{ url: string; init?: RequestInit }> = [];
    const reseau = (async (url: string, init?: RequestInit) => {
      appels.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const config = { bibliothequeId: "222", cle: "TEST_cle" };
    await deposerSousTitresBunny(config, EXTRAIT, "fr", "fr", VTT, reseau);
    await supprimerSousTitresBunny(config, EXTRAIT, "fr", reseau);
    const adresse = `https://video.bunnycdn.com/library/222/videos/${EXTRAIT}/captions/fr`;
    expect(appels.map((a) => `${a.init?.method} ${a.url}`)).toEqual([`POST ${adresse}`, `DELETE ${adresse}`]);
    const corps = JSON.parse(String(appels[0].init?.body));
    expect(corps).toMatchObject({ srclang: "fr" });
    expect(Buffer.from(corps.captionsFile, "base64").toString("utf8")).toBe(new TextDecoder().decode(VTT));
  });

  it("une erreur de Bunny lève, sans exposer la clé", async () => {
    const reseau = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    await expect(deposerSousTitresBunny({ bibliothequeId: "222", cle: "TEST_cle" }, EXTRAIT, "fr", "fr", VTT, reseau)).rejects.toThrow(/KS_BUNNY_ERREUR/);
  });
});

describe("sous-titres de l'extrait (service)", () => {
  const video = { bunnyIdPrive: PRIVE, extraitId: EXTRAIT, dureeSecondes: 600 };
  const entree = (partiel: Partial<Parameters<typeof deposerSousTitresExtrait>[1]> = {}) => ({
    produitId: TEST_KIT_ID,
    langue: "fr",
    nomFichier: "extrait.vtt",
    octets: VTT,
    ...partiel,
  });

  it("dépose chez Bunny puis enregistre la langue, puis vide le cache", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ videoKit: video });
    expect(await deposerSousTitresExtrait(deps, entree())).toEqual({ ok: true });
    expect(appels.bunny).toEqual([`POST 222/videos/${EXTRAIT}/captions/fr`]);
    expect(appels.ordre.slice(-3)).toEqual(["bunny:POST", "ecrireSousTitresExtrait", "invalidation"]);
  });

  it("un .vtt invalide est refusé avant tout appel à Bunny", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ videoKit: video });
    const r = await deposerSousTitresExtrait(deps, entree({ octets: new TextEncoder().encode("PAS UN VTT") }));
    expect(r).toEqual({ ok: false, erreur: "format_invalide" });
    expect(appels.bunny).toEqual([]);
    expect(deps.ecrireSousTitresExtrait).not.toHaveBeenCalled();
  });

  it("plus de 512 Ko ou autre extension : refusé", async () => {
    const { deps } = creerTestDependancesMediasKit({ videoKit: video });
    expect(await deposerSousTitresExtrait(deps, entree({ octets: new Uint8Array(512 * 1024 + 1) }))).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
    expect(await deposerSousTitresExtrait(deps, entree({ nomFichier: "x.srt" }))).toEqual({ ok: false, erreur: "format_invalide" });
  });

  it("Bunny indisponible : rien n'est enregistré", async () => {
    const { deps } = creerTestDependancesMediasKit({ videoKit: video, captionsEnEchec: true });
    expect(await deposerSousTitresExtrait(deps, entree())).toEqual({ ok: false, erreur: "bunny_indisponible" });
    expect(deps.ecrireSousTitresExtrait).not.toHaveBeenCalled();
  });

  it("sans extrait : extrait_absent ; sans vidéo : video_absente", async () => {
    const sans = creerTestDependancesMediasKit({ videoKit: { ...video, extraitId: null } });
    expect(await deposerSousTitresExtrait(sans.deps, entree())).toEqual({ ok: false, erreur: "extrait_absent" });
    const rien = creerTestDependancesMediasKit({});
    expect(await deposerSousTitresExtrait(rien.deps, entree())).toEqual({ ok: false, erreur: "video_absente" });
  });

  it("langue inconnue ou droit refusé : refusé", async () => {
    const { deps } = creerTestDependancesMediasKit({ videoKit: video });
    expect(await deposerSousTitresExtrait(deps, entree({ langue: "de" }))).toEqual({ ok: false, erreur: "langue_invalide" });
    const refus = creerTestDependancesMediasKit({ videoKit: video, droit: "KS_DROIT_REFUSE" });
    expect(await deposerSousTitresExtrait(refus.deps, entree())).toEqual({ ok: false, erreur: "non_autorise" });
  });

  it("refus de la base (code KS_) traduit", async () => {
    const { deps } = creerTestDependancesMediasKit({ videoKit: video, erreurSousTitresExtrait: "KS_EXTRAIT_ABSENT" });
    expect(await deposerSousTitresExtrait(deps, entree())).toEqual({ ok: false, erreur: "extrait_absent" });
  });

  it("refus de la base après le dépôt : les sous-titres sont retirés chez Bunny ; un échec du retrait n'est que journalisé", async () => {
    const { deps, appels } = creerTestDependancesMediasKit({ videoKit: video, erreurSousTitresExtrait: "KS_EXTRAIT_ABSENT" });
    await deposerSousTitresExtrait(deps, entree());
    expect(appels.bunny).toEqual([`POST 222/videos/${EXTRAIT}/captions/fr`, `DELETE 222/videos/${EXTRAIT}/captions/fr`]);
    expect(appels.ordre.indexOf("ecrireSousTitresExtrait")).toBeLessThan(appels.ordre.lastIndexOf("bunny:DELETE"));
    expect(appels.invalidations).toBe(0);

    const panne = creerTestDependancesMediasKit({ videoKit: video, erreurSousTitresExtrait: "KS_EXTRAIT_ABSENT" });
    let n = 0;
    const reseau = panne.deps.reseau;
    panne.deps.reseau = (async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") throw new Error("TEST_coupure");
      n += 1;
      return reseau(url, init);
    }) as typeof fetch;
    expect(await deposerSousTitresExtrait(panne.deps, entree())).toEqual({ ok: false, erreur: "extrait_absent" });
    expect(n).toBe(1);
  });

  it("KS_VALEUR_INVALIDE est traduit (generique)", async () => {
    const { deps } = creerTestDependancesMediasKit({ videoKit: video, erreurSansParole: "KS_VALEUR_INVALIDE" });
    expect(await definirExtraitSansParole(deps, { produitId: TEST_KIT_ID, valeur: true })).toEqual({ ok: false, erreur: "generique" });
  });

  it("suppression : la base d'abord, puis Bunny ; un refus de la base n'appelle pas Bunny", async () => {
    const ok = creerTestDependancesMediasKit({ videoKit: video });
    expect(await supprimerSousTitresExtrait(ok.deps, { produitId: TEST_KIT_ID, langue: "en" })).toEqual({ ok: true });
    expect(ok.appels.ordre.filter((o) => o === "supprimerSousTitresExtrait" || o === "bunny:DELETE")).toEqual(["supprimerSousTitresExtrait", "bunny:DELETE"]);
    const refus = creerTestDependancesMediasKit({ videoKit: video, erreurSousTitresExtrait: "KS_PUBLICATION_INCOMPLETE" });
    expect(await supprimerSousTitresExtrait(refus.deps, { produitId: TEST_KIT_ID, langue: "fr" })).toEqual({ ok: false, erreur: "publication_incomplete" });
    expect(refus.appels.bunny).toEqual([]);
  });

  it("case « Extrait sans parole » : enregistrée, refus traduit", async () => {
    const ok = creerTestDependancesMediasKit({ videoKit: video });
    expect(await definirExtraitSansParole(ok.deps, { produitId: TEST_KIT_ID, valeur: true })).toEqual({ ok: true });
    expect(ok.deps.definirExtraitSansParole).toHaveBeenCalledWith(expect.objectContaining({ produitId: TEST_KIT_ID, valeur: true }));
    const refus = creerTestDependancesMediasKit({ videoKit: video, erreurSansParole: "KS_PUBLICATION_INCOMPLETE" });
    expect(await definirExtraitSansParole(refus.deps, { produitId: TEST_KIT_ID, valeur: false })).toEqual({ ok: false, erreur: "publication_incomplete" });
  });
});
