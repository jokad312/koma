// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { adressesVideoPrivee, DUREE_JETON_VIDEO_SECONDES, lireConfigLecturePrivee } from "@/lib/bunny/jeton";

const VIDEO = "11111111-2222-4333-8444-555555555555";
const CONFIG = { hoteCdn: "test-prive.b-cdn.net", cleJeton: "TEST_cle_de_jeton_0001" };

describe("adressesVideoPrivee", () => {
  it("jeton de répertoire SHA-256 simple (clé + répertoire + expiration + token_path brut), style chemin : la playlist et les sous-titres partagent le même jeton", () => {
    const expire = 1_800_000_000;
    const a = adressesVideoPrivee(CONFIG, VIDEO, expire);
    const repertoire = `/${VIDEO}/`;
    const tokenPath = encodeURIComponent(repertoire);
    const attendu = createHash("sha256").update(`${CONFIG.cleJeton}${repertoire}${expire}token_path=${repertoire}`).digest("base64url");
    const base = `https://${CONFIG.hoteCdn}/bcdn_token=${attendu}&expires=${expire}&token_path=${tokenPath}${repertoire}`;
    expect(a.playlist).toBe(`${base}playlist.m3u8`);
    expect(a.sousTitres("fr")).toBe(`${base}captions/fr.vtt`);
    expect(a.sousTitres("en")).toBe(`${base}captions/en.vtt`);
  });

  it("le jeton est en Base64URL sans remplissage et ne contient pas la clé", () => {
    const a = adressesVideoPrivee(CONFIG, VIDEO, 1_800_000_000);
    const jeton = /bcdn_token=([^&]+)&/.exec(a.playlist)?.[1] ?? "";
    expect(a.playlist).not.toContain("HS256");
    expect(jeton).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.playlist).not.toContain(CONFIG.cleJeton);
  });

  it("une autre expiration, une autre clé ou une autre vidéo donne un autre jeton", () => {
    const de = (config: typeof CONFIG, id: string, expire: number) => /bcdn_token=([^&]+)&/.exec(adressesVideoPrivee(config, id, expire).playlist)?.[1];
    const base = de(CONFIG, VIDEO, 1_800_000_000);
    expect(de(CONFIG, VIDEO, 1_800_000_001)).not.toBe(base);
    expect(de({ ...CONFIG, cleJeton: "TEST_autre_cle_0002" }, VIDEO, 1_800_000_000)).not.toBe(base);
    expect(de(CONFIG, "aaaaaaaa-2222-4333-8444-555555555555", 1_800_000_000)).not.toBe(base);
  });

  it("refuse un identifiant de vidéo mal formé (aucun chemin forgé) et une expiration invalide", () => {
    expect(() => adressesVideoPrivee(CONFIG, "../../autre", 1_800_000_000)).toThrow();
    expect(() => adressesVideoPrivee(CONFIG, `${VIDEO}/..`, 1_800_000_000)).toThrow();
    expect(() => adressesVideoPrivee(CONFIG, VIDEO, 0)).toThrow();
    expect(() => adressesVideoPrivee(CONFIG, VIDEO, 1.5)).toThrow();
  });

  it("la durée d'un jeton est de 4 heures", () => {
    expect(DUREE_JETON_VIDEO_SECONDES).toBe(14_400);
  });
});

describe("lireConfigLecturePrivee", () => {
  it("lit la clé et le nom d'hôte (avec ou sans https://)", () => {
    expect(lireConfigLecturePrivee({ BUNNY_PRIVE_TOKEN_KEY: "TEST_cle_de_jeton_0001", BUNNY_PRIVE_CDN_HOSTNAME: "https://Test-Prive.b-cdn.net/" })).toEqual({
      hoteCdn: "test-prive.b-cdn.net",
      cleJeton: "TEST_cle_de_jeton_0001",
    });
  });
  it("une variable absente lève une erreur qui nomme la variable, jamais sa valeur", () => {
    expect(() => lireConfigLecturePrivee({ BUNNY_PRIVE_CDN_HOSTNAME: "test-prive.b-cdn.net" })).toThrow(/BUNNY_PRIVE_TOKEN_KEY/);
    expect(() => lireConfigLecturePrivee({ BUNNY_PRIVE_TOKEN_KEY: "TEST_cle_de_jeton_0001" })).toThrow(/BUNNY_PRIVE_CDN_HOSTNAME/);
    try {
      lireConfigLecturePrivee({ BUNNY_PRIVE_TOKEN_KEY: "TEST_cle_de_jeton_0001" });
    } catch (e) {
      expect(String(e)).not.toContain("TEST_cle_de_jeton_0001");
    }
  });
});
