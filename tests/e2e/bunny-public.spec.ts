import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { creerVideoBunny, lireVideoBunny, signerEnvoiBunny, supprimerVideoBunny } from "../../src/lib/bunny/api";
import { lireConfigBunnyPublic, type ConfigBunnyPublic } from "../../src/lib/bunny/config";

// Réseau réel, bibliothèque Bunny PUBLIQUE : crée une vidéo nommée koma-heros-TEST_…, prouve que la signature d'envoi TUS est acceptée
// (et qu'une signature fausse est refusée), puis efface TOUJOURS la vidéo. Rien ne reste dans la bibliothèque.
// Sauté sans message d'erreur si les variables Bunny publiques manquent (CI). Aucune valeur secrète n'est affichée.

function lireEnv(): Record<string, string | undefined> {
  const source: Record<string, string | undefined> = { ...process.env };
  if (existsSync(".env.local")) {
    for (const ligne of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(ligne);
      if (m && !source[m[1]]) source[m[1]] = m[2].replace(/^["']|["']$/g, "") || undefined;
    }
  }
  return source;
}

function configOuNull(): ConfigBunnyPublic | null {
  try {
    return lireConfigBunnyPublic(lireEnv());
  } catch {
    return null;
  }
}

test("Bunny publique : création, signature TUS valide et refus d'une fausse signature, puis effacement", async () => {
  const config = configOuNull();
  test.skip(!config, "Test sauté : BUNNY_PUBLIC_LIBRARY_ID, BUNNY_PUBLIC_API_KEY ou NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME est absente de l'environnement et de .env.local.");
  const c = config as ConfigBunnyPublic;
  const video = await creerVideoBunny(c, `koma-heros-TEST_${randomUUID()}`);
  try {
    expect(video.etat).toBe("cree");
    const auth = signerEnvoiBunny(c, video.id, Date.now());
    const creer = (signature: string) =>
      fetch(auth.adresse, {
        method: "POST",
        headers: {
          "Tus-Resumable": "1.0.0",
          "Upload-Length": "1000",
          "Upload-Metadata": `filetype ${Buffer.from("video/mp4").toString("base64")},title ${Buffer.from("TEST_").toString("base64")}`,
          AuthorizationSignature: signature,
          AuthorizationExpire: String(auth.expiration),
          VideoId: auth.videoId,
          LibraryId: auth.bibliothequeId,
        },
      });

    const refusee = await creer("0".repeat(64));
    expect(refusee.status, "une fausse signature doit être refusée").toBeGreaterThanOrEqual(400);

    const acceptee = await creer(auth.signature);
    expect(acceptee.status, "la signature calculée par le serveur doit être acceptée").toBe(201);
    expect(acceptee.headers.get("location")).toBeTruthy();
  } finally {
    await supprimerVideoBunny(c, video.id);
  }
  expect(await lireVideoBunny(c, video.id), "la vidéo de test doit avoir disparu").toBeNull();
});
