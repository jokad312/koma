import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BunnyErreur, choisirFichierMp4, creerVideoBunny, lireVideoBunny, signerEnvoiBunny, supprimerVideoBunny } from "@/lib/bunny/api";
import { BunnyNonConfigureError, lireConfigBunnyPublic, normaliserHote } from "@/lib/bunny/config";
import { adresseVideoHeros, resumerDisponibilite } from "@/modules/accueil/heros-affichage";

// Valeurs de test (TEST_) : aucune vraie clé ni identifiant.
const CONFIG = { bibliothequeId: "123456", cle: "TEST_cle-factice", hoteCdn: "vz-test.b-cdn.net" };
const ID = "11111111-2222-4333-8444-555555555555";

function reseau(statut: number, corps: unknown, appels: Array<{ url: string; init?: RequestInit }> = []): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    appels.push({ url, init });
    return new Response(JSON.stringify(corps), { status: statut });
  }) as unknown as typeof fetch;
}

describe("configuration Bunny publique", () => {
  it("TEST_ lit les trois variables et normalise l'hôte", () => {
    const c = lireConfigBunnyPublic({ BUNNY_PUBLIC_LIBRARY_ID: "42", BUNNY_PUBLIC_API_KEY: "TEST_cle-factice", NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME: "https://VZ-Test.b-cdn.net/" });
    expect(c).toEqual({ bibliothequeId: "42", cle: "TEST_cle-factice", hoteCdn: "vz-test.b-cdn.net" });
  });

  it("TEST_ une variable absente nomme la variable, jamais une valeur", () => {
    try {
      lireConfigBunnyPublic({ BUNNY_PUBLIC_LIBRARY_ID: "42", BUNNY_PUBLIC_API_KEY: "", NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME: "" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BunnyNonConfigureError);
      expect((e as Error).message).toContain("BUNNY_PUBLIC_API_KEY");
      expect((e as Error).message).toContain("NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME");
    }
  });

  it("TEST_ refuse un hôte qui n'en est pas un", () => {
    expect(normaliserHote("javascript:alert(1)")).toBeNull();
    expect(normaliserHote("a b.com")).toBeNull();
    expect(normaliserHote("")).toBeNull();
  });
});

describe("signature d'envoi TUS", () => {
  it("TEST_ SHA-256 de bibliothèque + clé + expiration + vidéo, sans la clé dans le résultat", () => {
    const a = signerEnvoiBunny(CONFIG, ID, 1_000_000_000_000);
    const attendu = createHash("sha256").update(`123456TEST_cle-factice${a.expiration}${ID}`).digest("hex");
    expect(a.signature).toBe(attendu);
    expect(a.expiration).toBe(1_000_000_000 + 6 * 3600);
    expect(JSON.stringify(a)).not.toContain(CONFIG.cle);
    expect(a.adresse).toBe("https://video.bunnycdn.com/tusupload");
  });
});

describe("appels à l'API Bunny", () => {
  it("TEST_ création : clé en en-tête, titre envoyé, vidéo lue", async () => {
    const appels: Array<{ url: string; init?: RequestInit }> = [];
    const v = await creerVideoBunny(CONFIG, "koma-heros-x", reseau(200, { guid: ID, title: "koma-heros-x", status: 0 }, appels));
    expect(v).toMatchObject({ id: ID, etat: "cree" });
    expect(appels[0].url).toBe("https://video.bunnycdn.com/library/123456/videos");
    expect((appels[0].init?.headers as Record<string, string>).AccessKey).toBe(CONFIG.cle);
    expect(appels[0].init?.body).toBe(JSON.stringify({ title: "koma-heros-x" }));
  });

  it("TEST_ les statuts de Bunny deviennent des états", async () => {
    const etat = async (status: number) => (await lireVideoBunny(CONFIG, ID, reseau(200, { guid: ID, title: "t", status, encodeProgress: 40, availableResolutions: "360p,720p" })))?.etat;
    expect(await etat(1)).toBe("envoye");
    expect(await etat(3)).toBe("encodage");
    expect(await etat(4)).toBe("termine");
    expect(await etat(5)).toBe("echec");
    expect(await etat(6)).toBe("echec");
  });

  it("TEST_ lecture : 404 = null, autre erreur = exception sans la clé", async () => {
    expect(await lireVideoBunny(CONFIG, ID, reseau(404, {}))).toBeNull();
    const erreur = await lireVideoBunny(CONFIG, ID, reseau(500, {})).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(BunnyErreur);
    expect((erreur as Error).message).not.toContain(CONFIG.cle);
  });

  it("TEST_ un identifiant de vidéo invalide n'appelle jamais le réseau", async () => {
    const appels: Array<{ url: string; init?: RequestInit }> = [];
    expect(await lireVideoBunny(CONFIG, "../x", reseau(200, {}, appels))).toBeNull();
    await supprimerVideoBunny(CONFIG, "../x", reseau(200, {}, appels));
    expect(appels).toHaveLength(0);
  });

  it("TEST_ suppression : 404 vaut déjà effacée", async () => {
    await expect(supprimerVideoBunny(CONFIG, ID, reseau(404, {}))).resolves.toBeUndefined();
    await expect(supprimerVideoBunny(CONFIG, ID, reseau(401, {}))).rejects.toBeInstanceOf(BunnyErreur);
  });
});

describe("choix du fichier MP4 et adresse", () => {
  it("TEST_ 720p si présente, sinon la plus grande en dessous, sinon la plus petite", () => {
    expect(choisirFichierMp4(["240p", "360p", "720p", "1080p"])).toBe("play_720p.mp4");
    expect(choisirFichierMp4(["240p", "480p"])).toBe("play_480p.mp4");
    expect(choisirFichierMp4(["1080p", "1440p"])).toBe("play_1080p.mp4");
    expect(choisirFichierMp4([])).toBeNull();
    expect(choisirFichierMp4(["x"])).toBeNull();
  });

  it("TEST_ adresse du MP4 : rien tant que le fichier n'est pas validé", () => {
    expect(adresseVideoHeros("vz-test.b-cdn.net", ID, "play_720p.mp4")).toBe(`https://vz-test.b-cdn.net/${ID}/play_720p.mp4`);
    expect(adresseVideoHeros("vz-test.b-cdn.net", ID, null)).toBeNull();
    expect(adresseVideoHeros(null, ID, "play_720p.mp4")).toBeNull();
    expect(adresseVideoHeros("vz-test.b-cdn.net", ID, "../x.mp4")).toBeNull();
  });
});

describe("disponibilité de la vedette", () => {
  const taille = (etat: "disponible" | "dernieres_pieces" | "sur_commande" | "complet" | "epuise", delaiJours: number | null) => ({ taille: "M" as const, etat, delaiJours });
  it("TEST_ garde le meilleur état et le plus court délai de fabrication", () => {
    expect(resumerDisponibilite({ tailles: [taille("epuise", null), taille("sur_commande", 20), taille("sur_commande", 12)] })).toEqual({ etat: "sur_commande", delaiJours: 12 });
    expect(resumerDisponibilite({ tailles: [taille("sur_commande", 5), taille("disponible", null)] })).toEqual({ etat: "disponible", delaiJours: null });
    expect(resumerDisponibilite({ tailles: [] })).toEqual({ etat: "epuise", delaiJours: null });
  });
});
