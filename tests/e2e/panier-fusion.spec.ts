import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import sharp from "sharp";
import { NOM_COOKIE_PANIER } from "../../src/lib/panier/cookie";

// Bug A1 (2026-11-22) : « fusion du Panier impossible » à la connexion par code. Parcours réel : Panier de visiteur, connexion par code,
// articles retrouvés dans /fr/panier ; et connexion sans Panier de visiteur (le cas qui plantait : 55000 dans fusionner_panier).
// Le code est lu dans la boîte de test Mailpit (base locale de la CI) : sans elle (koma-dev en local), les tests sont ignorés, raison écrite.
// Ces e2e prouvent le parcours, PAS la non-régression du 55000 : le défaut n'apparaît qu'au premier appel de fusionner_panier dans une session
// Postgres neuve, et les connexions de PostgREST ont pu l'appeler avant. La garde est supabase/tests/fusion_panier_premier_appel.test.sql
// (seul appel de sa session) ; les 4 cas : fusion_panier_quatre_cas.test.sql. Les deux se lancent aussi sur koma-dev (npm run test:sql:linked).
// Données TEST_ (produit, photo dessinée ici, Comptes) supprimées à la fin, même en cas d'échec, puis comptées (0 attendu).
// Aucun paiement ni statut simulé (règle 13) : le Panier reste un Panier, rien n'est commandé.

const AUTEUR = `{"type":"systeme","nom":"e2e A1 TEST"}`;
const ID = "00000000-0000-4000-8a01-000000000001";
const SLUG = "test-e2e-a1-objet";
const TITRE = "TEST_ Objet fusion";
const FICHIER = "test-e2e-a1/objet.jpg";
const EMAIL_PREFIXE = "test-e2e-a1-";
const BOITE = process.env.MAILPIT_URL?.replace(/\/+$/, "");

async function boiteJoignable(): Promise<boolean> {
  if (!BOITE) return false;
  try {
    return (await fetch(`${BOITE}/api/v1/info`)).ok;
  } catch {
    return false;
  }
}

function lireEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI : les variables sont déjà définies.
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secrete = process.env.SUPABASE_SECRET_KEY;
  return url && secrete ? { url, secrete } : null;
}
const env = lireEnv();

// SQL par la Supabase CLI (base liée en local, base locale en CI) ; un seul bloc `do` : une seule commande pour `--local`.
function sqlBloc(corps: string): void {
  const dossier = mkdtempSync(join(tmpdir(), "e2e-a1-"));
  const fichier = join(dossier, "requete.sql");
  writeFileSync(fichier, ["do $bloc$", "begin", `perform set_config('ks.auteur', '${AUTEUR}', true);`, corps, "end", "$bloc$;"].join("\n"));
  const r = spawnSync("npx", ["supabase", "db", "query", process.env.CI ? "--local" : "--linked", "-f", fichier], { encoding: "utf8", shell: true });
  rmSync(dossier, { recursive: true, force: true });
  if (r.status !== 0 || /"error"|ERROR/.test(r.stdout + r.stderr)) throw new Error(`SQL en échec : ${(r.stdout + r.stderr).slice(0, 1200)}`);
}

function service(): SupabaseClient {
  if (!env) throw new Error("variables Supabase absentes");
  return createClient(env.url, env.secrete, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function comptesTest(): Promise<string[]> {
  const { data, error } = await service().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`liste des Comptes : ${error.message}`);
  return data.users.filter((u) => (u.email ?? "").startsWith(EMAIL_PREFIXE)).map((u) => u.id);
}

async function nettoyer() {
  const comptes = await comptesTest();
  const liste = comptes.length > 0 ? comptes.map((c) => `'${c}'`).join(",") : "null";
  sqlBloc(`delete from public.ligne_panier where produit_id = '${ID}' or panier_id in (select id from public.panier where compte_id in (${liste}));
delete from public.panier where compte_id in (${liste});
alter table public.produit disable trigger produit_publie_complet;
delete from public.produit_photo where produit_id = '${ID}';
delete from public.variante where produit_id = '${ID}';
delete from public.produit where id = '${ID}' or slug = '${SLUG}';
alter table public.produit enable trigger produit_publie_complet;`);
  await service().storage.from("produits-public").remove([FICHIER]);
  for (const id of comptes) {
    const { error } = await service().auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) throw new Error(`suppression du Compte TEST_ impossible : ${error.message}`);
  }
}

async function compterRestes(): Promise<Record<string, number>> {
  const compter = async (table: string, colonne: string): Promise<number> => {
    const { count, error } = await service().from(table).select("*", { count: "exact", head: true }).eq(colonne, ID);
    if (error || count === null) throw new Error(`comptage de ${table} impossible : ${error?.message}`);
    return count;
  };
  const { data } = await service().storage.from("produits-public").list("test-e2e-a1");
  return {
    produits: await compter("produit", "id"),
    variantes: await compter("variante", "produit_id"),
    photos: await compter("produit_photo", "produit_id"),
    lignes_panier: await compter("ligne_panier", "produit_id"),
    comptes: (await comptesTest()).length,
    fichiers: (data ?? []).length,
  };
}

// « Autre article » publié, Taille unique, stock 5 : s'ajoute au panier sans choix de taille.
async function semer() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#3a3430"/></svg>`;
  const { error } = await service().storage.from("produits-public").upload(FICHIER, await sharp(Buffer.from(svg)).jpeg().toBuffer(), { upsert: true, contentType: "image/jpeg" });
  if (error) throw new Error(`envoi de la photo impossible : ${error.message}`);
  sqlBloc(`alter table public.produit disable trigger produit_publie_complet;
insert into public.produit (id, famille, slug, titre_fr, titre_en, description_fr, description_en, prix_cents) values
  ('${ID}', 'autre', '${SLUG}', '${TITRE}', '${TITRE} EN', 'TEST_ description', 'TEST_ description', 1200);
insert into public.produit_photo (produit_id, fichier, position, alt_fr, alt_en) values ('${ID}', '${FICHIER}', 1, 'TEST_ photo de l''objet', 'TEST_ object photo');
insert into public.variante (produit_id, taille, stock) values ('${ID}', 'unique', 5);
update public.produit set publie_le = now() - interval '1 hour' where id = '${ID}';
alter table public.produit enable trigger produit_publie_complet;`);
}

// Compte TEST_ complet (âge et questions d'accueil passés) : après le code, la connexion mène directement à la page quittée.
async function compteComplet(): Promise<{ id: string; email: string }> {
  const admin = service();
  const email = `${EMAIL_PREFIXE}${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const cree = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: "TEST Fusion" } });
  if (cree.error || !cree.data.user) throw new Error(`création du Compte TEST_ impossible : ${cree.error?.message}`);
  const id = cree.data.user.id;
  for (const [fn, args] of [
    ["declarer_age", { p_auteur: { type: "systeme", nom: "e2e A1 TEST" }, p_compte: id, p_age: 25 }],
    ["enregistrer_questions_accueil", { p_auteur: { type: "compte", id, role: null }, p_compte: id, p_origine: null, p_preference: null }],
  ] as const) {
    const r = await admin.rpc(fn, args);
    if (r.error) throw new Error(`${fn} : ${r.error.message}`);
  }
  return { id, email };
}

async function lireCode(request: APIRequestContext, email: string): Promise<string> {
  let code = "";
  await expect
    .poll(
      async () => {
        const recherche = await request.get(`${BOITE}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
        const { messages } = (await recherche.json()) as { messages?: { ID: string }[] };
        if (!messages?.length) return "";
        const message = await request.get(`${BOITE}/api/v1/message/${messages[0].ID}`);
        const { Text } = (await message.json()) as { Text?: string };
        code = /\b(\d{6})\b/.exec(Text ?? "")?.[1] ?? "";
        return code;
      },
      { timeout: 20_000, message: "le code n'est pas arrivé dans la boîte de test" },
    )
    .toMatch(/^\d{6}$/);
  return code;
}

// Connexion par code depuis /fr/connexion?retour=/fr/panier (saisie répétée tant que la page n'est pas hydratée, comme connexion.spec.ts).
async function seConnecterParCode(page: Page, request: APIRequestContext, email: string) {
  await page.goto("/fr/connexion?retour=%2Ffr%2Fpanier", { waitUntil: "networkidle" });
  await expect(async () => {
    await page.getByLabel("Adresse email").fill(email);
    await page.getByRole("button", { name: "Recevoir un code" }).click();
    await expect(page.getByText(`Un code a été envoyé à ${email}.`)).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Code à 6 chiffres").fill(await lireCode(request, email));
  await page.getByRole("button", { name: "Valider le code" }).click();
  await expect(page).toHaveURL(/\/fr\/panier$/, { timeout: 20_000 });
}

const ligneDuProduit = (page: Page) => page.getByRole("main").getByText(TITRE, { exact: true });

test.describe.configure({ mode: "serial" });

test.describe("bug A1 : le Panier suit le Compte à la connexion par code", () => {
  test.describe.configure({ timeout: 120_000 });

  // Sans Mailpit (koma-dev en local), tous les tests sont ignorés : rien n'est semé ni nettoyé.
  let actif = false;
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    actif = Boolean(env) && (await boiteJoignable());
    if (!actif) return;
    await nettoyer();
    await semer();
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    if (!actif) return;
    let erreurNettoyage: unknown = null;
    try {
      await nettoyer();
    } catch (e) {
      erreurNettoyage = e;
    }
    const restes = await compterRestes();
    console.log(`[e2e A1] données TEST_ restantes : ${JSON.stringify(restes)}`);
    if (erreurNettoyage) throw erreurNettoyage;
    expect(restes).toEqual({ produits: 0, variantes: 0, photos: 0, lignes_panier: 0, comptes: 0, fichiers: 0 });
  });

  test.beforeEach(async () => {
    test.skip(!env, "variables Supabase absentes");
    const joignable = await boiteJoignable();
    if (process.env.CI) expect(joignable, "MAILPIT_URL absente ou boîte de test injoignable en CI").toBe(true);
    else test.skip(!joignable, "Boîte de test locale (Mailpit) absente : aucun vrai code n'est envoyé depuis koma-dev. Cas couverts sur koma-dev par npm run test:sql:linked.");
  });

  test("Panier de visiteur avec un article, puis connexion par code : l'article est toujours dans /fr/panier", async ({ page, request }) => {
    const { email } = await compteComplet();
    await page.goto(`/fr/autres-articles/${SLUG}`, { waitUntil: "networkidle" });
    await expect(async () => {
      await page.getByRole("button", { name: "Ajouter au panier" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Ajouté au panier" })).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 20_000 });
    await page.goto("/fr/panier", { waitUntil: "networkidle" });
    await expect(ligneDuProduit(page)).toBeVisible();
    // Le visiteur a bien un Panier en cookie : la fusion reçoit un p_panier non nul.
    expect((await page.context().cookies()).some((c) => c.name === NOM_COOKIE_PANIER)).toBe(true);

    await seConnecterParCode(page, request, email);
    await expect(ligneDuProduit(page)).toBeVisible();
    // Capture publiée par la CI (artefact « captures-e2e ») : le Panier conservé après la connexion.
    await page.screenshot({ path: "test-results/captures/a1-panier-apres-connexion.png", fullPage: true, mask: [page.locator("header")] });
  });

  test("sans Panier de visiteur, Compte qui a déjà un Panier : connexion sans erreur, son Panier est affiché", async ({ page, request }) => {
    const { id, email } = await compteComplet();
    // Panier du Compte : création et ajout par les fonctions du site, rattachement par SQL direct (sans appeler fusionner_panier).
    const admin = service();
    const cree = await admin.rpc("creer_panier", { p_auteur: { type: "systeme", nom: "e2e A1 TEST" } });
    if (cree.error || typeof cree.data !== "string") throw new Error(`creer_panier : ${cree.error?.message}`);
    const ajout = await admin.rpc("ajouter_au_panier", { p_auteur: { type: "systeme", nom: "e2e A1 TEST" }, p_panier: cree.data, p_compte: null, p_produit: ID, p_taille: "unique", p_nombre: 1 });
    if (ajout.error) throw new Error(`ajouter_au_panier : ${ajout.error.message}`);
    sqlBloc(`update public.panier set compte_id = '${id}' where id = '${cree.data}';`);

    // Visiteur sans cookie de Panier : la fusion reçoit p_panier = null (le cas qui échouait).
    expect((await page.context().cookies()).some((c) => c.name === NOM_COOKIE_PANIER)).toBe(false);
    await seConnecterParCode(page, request, email);
    await expect(ligneDuProduit(page)).toBeVisible();
    await page.screenshot({ path: "test-results/captures/a1-panier-du-compte-sans-panier-visiteur.png", fullPage: true, mask: [page.locator("header")] });
  });
});
