import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Règle 1 : une adresse directe d'un fichier de kits-private, sans lien signé, renvoie une erreur (avec ou sans la clé publique).
// Le test crée un objet nommé TEST_ avec la clé de service, vérifie que l'accès anonyme échoue, puis l'efface toujours.
// Il se saute avec un message clair si la clé de service manque ou si le bucket n'existe pas encore (migration pas encore appliquée).
// Aucune valeur secrète n'est affichée ni écrite dans un message.

function lireEnv(nom: string): string | undefined {
  const deProcessus = process.env[nom];
  if (deProcessus) return deProcessus;
  // Le processus Playwright ne charge pas .env.local (c'est le serveur Next qui le fait) : lecture directe, sans rien afficher.
  if (!existsSync(".env.local")) return undefined;
  for (const ligne of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(ligne);
    if (m && m[1] === nom) {
      const valeur = m[2].replace(/^["']|["']$/g, "");
      return valeur === "" ? undefined : valeur;
    }
  }
  return undefined;
}

// Même condition de saut pour les deux tests : variables absentes ou bucket pas encore créé.
async function preparer() {
  const adresse = lireEnv("NEXT_PUBLIC_SUPABASE_URL")?.replace(/\/+$/, "");
  const clePublique = lireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const cleService = lireEnv("SUPABASE_SECRET_KEY");
  test.skip(!adresse || !clePublique, "Test sauté : NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est absente de l'environnement et de .env.local.");
  test.skip(!cleService, "Test sauté : SUPABASE_SECRET_KEY (clé de service) est absente de l'environnement et de .env.local ; sans elle, l'objet de test ne peut pas être créé.");
  const admin = createClient(adresse as string, cleService as string, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = await admin.storage.getBucket("kits-private");
  test.skip(!!bucket.error || !bucket.data, "Test sauté : le bucket kits-private n'existe pas encore sur ce projet Supabase (la migration 20261030100000 n'est pas appliquée). À relancer après npm run db:push.");
  // Le bucket existe : il doit être privé.
  expect(bucket.data?.public).toBe(false);
  return { adresse: adresse as string, clePublique: clePublique as string, admin };
}

test.describe("fichiers de kits : accès direct", () => {
  test.describe.configure({ timeout: 60_000 });

  test("une adresse directe d'un objet de kits-private est refusée, avec ou sans la clé publique", async ({ request }) => {
    const { adresse, clePublique, admin } = await preparer();

    const objet = `TEST_acces-direct/${randomUUID()}.txt`;
    const chemin = objet.split("/").map(encodeURIComponent).join("/");
    const televerse = await admin.storage.from("kits-private").upload(objet, new Blob(["TEST_contenu prive"], { type: "text/plain" }), { contentType: "text/plain", upsert: false });
    expect(televerse.error, "l'objet TEST_ doit pouvoir être créé avec la clé de service").toBeNull();

    try {
      const entetesPublics = { apikey: clePublique, Authorization: `Bearer ${clePublique}` };
      const racine = `${adresse}/storage/v1/object`;
      const adresses = [
        `${racine}/kits-private/${chemin}`,
        `${racine}/public/kits-private/${chemin}`,
        `${racine}/authenticated/kits-private/${chemin}`,
      ];
      for (const url of adresses) {
        // Sans clé, puis avec la clé publique : toujours une erreur, jamais le contenu.
        for (const entetes of [{}, entetesPublics]) {
          const reponse = await request.get(url, { headers: entetes, failOnStatusCode: false });
          expect(reponse.ok(), `GET ${url.replace(adresse, "")} ${Object.keys(entetes).length ? "avec" : "sans"} la clé publique`).toBe(false);
          expect(reponse.status()).toBeGreaterThanOrEqual(400);
          expect(reponse.status()).toBeLessThan(500);
          expect(await reponse.text()).not.toContain("TEST_contenu prive");
        }
      }

      // Preuve que l'erreur vient de la confidentialité et non d'un objet absent : la clé de service, elle, le lit.
      const lu = await admin.storage.from("kits-private").download(objet);
      expect(lu.error).toBeNull();
      expect(await lu.data?.text()).toBe("TEST_contenu prive");
    } finally {
      // Toujours effacé, même si une vérification échoue.
      const efface = await admin.storage.from("kits-private").remove([objet]);
      expect(efface.error, "l'objet TEST_ doit être effacé").toBeNull();
    }
    const apres = await admin.storage.from("kits-private").download(objet);
    expect(apres.error, "l'objet TEST_ n'existe plus").not.toBeNull();
  });

  // Contrat réel du stockage utilisé par la finalisation (story 3.1) : jeton de dépôt signé, taille lue par info(), lecture d'un début
  // par lien signé avec en-tête Range, déplacement vers un nouveau chemin. Tout est effacé dans le finally.
  test("contrat du stockage : dépôt signé, info(), lecture Range, déplacement", async ({ request }) => {
    const { admin } = await preparer();
    const stockage = admin.storage.from("kits-private");
    // Dossier de la forme <produit>/<uuid>.pdf, sans produit réel : seul le stockage est exercé.
    const dossier = randomUUID();
    const objet = `${dossier}/${randomUUID()}.pdf`;
    const nouveau = `${dossier}/${randomUUID()}.pdf`;
    const pdf = new TextEncoder().encode(`%PDF-1.4
${"TEST_contrat ".repeat(20)}
%%EOF
`);

    try {
      const jeton = await stockage.createSignedUploadUrl(objet);
      expect(jeton.error).toBeNull();
      expect(jeton.data?.token).toBeTruthy();
      const depot = await stockage.uploadToSignedUrl(objet, jeton.data?.token as string, new Blob([pdf], { type: "application/pdf" }), { contentType: "application/pdf" });
      expect(depot.error, "le dépôt avec le jeton signé").toBeNull();

      const info = await stockage.info(objet);
      expect(info.error).toBeNull();
      expect(info.data?.size).toBe(pdf.byteLength);

      const lien = await stockage.createSignedUrl(objet, 60);
      expect(lien.error).toBeNull();
      const lecture = await request.get(lien.data?.signedUrl as string, { headers: { Range: "bytes=0-7" }, failOnStatusCode: false });
      expect([200, 206]).toContain(lecture.status());
      expect((await lecture.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
      if (lecture.status() === 206) expect((await lecture.body()).byteLength).toBe(8);

      const deplace = await stockage.move(objet, nouveau);
      expect(deplace.error, "le déplacement vers un nouveau chemin").toBeNull();
      const ancien = await stockage.info(objet);
      expect(ancien.error, "l'ancien chemin est vide après le déplacement").not.toBeNull();
      const apres = await stockage.info(nouveau);
      expect(apres.error).toBeNull();
      expect(apres.data?.size).toBe(pdf.byteLength);
    } finally {
      await stockage.remove([objet, nouveau]);
    }
    const reste = await stockage.info(nouveau);
    expect(reste.error, "les objets de test sont effacés").not.toBeNull();
  });
});
