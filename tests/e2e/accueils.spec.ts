import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
// Story 9.12 : accueils selon la connexion (option A du 2026-11-13). Accueil public à 375 px, espace personnel d'un client TEST_ (1440 et 375 px),
// arrivée de l'admin à la connexion.
// Les captures vont dans docs/captures-accueil/ (outil local, jamais commité). Comptes TEST_ créés par l'API d'administration de Supabase,
// supprimés à la fin (aucune donnée TEST_ laissée sur la base) ; aucun paiement ni statut simulé (règle 13).

const DOSSIER = join(process.cwd(), "docs", "captures-accueil");

function lireEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI : les variables sont déjà définies.
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publique = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secrete = process.env.SUPABASE_SECRET_KEY;
  return url && publique && secrete ? { url, publique, secrete } : null;
}

// Compte TEST_ réel (créé par l'API d'administration, âge déclaré) et sa session posée dans le navigateur. Rôle facultatif, retiré avec le Compte.
async function connecterCompteTest(page: Page, env: NonNullable<ReturnType<typeof lireEnv>>, role?: "admin") {
  const admin = createClient(env.url, env.secrete, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `test-accueils-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.invalid`;
  const cree = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: "TEST Espace" } });
  if (cree.error || !cree.data.user) throw new Error(`création du Compte TEST_ impossible : ${cree.error?.message}`);
  const id = cree.data.user.id;
  const nettoyer = async () => {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`suppression du Compte TEST_ impossible : ${error.message}`);
  };
  try {
    const age = await admin.rpc("declarer_age", { p_auteur: { type: "systeme", nom: "test e2e 9.12" }, p_compte: id, p_age: 25 });
    if (age.error) throw new Error(`âge : ${age.error.message}`);
    // Questions d'accueil passées (réponses vides, comme le bouton « Passer ») : le Compte est complet.
    const questions = await admin.rpc("enregistrer_questions_accueil", { p_auteur: { type: "compte", id, role: null }, p_compte: id, p_origine: null, p_preference: null });
    if (questions.error) throw new Error(`questions : ${questions.error.message}`);
    if (role) {
      const r = await admin.rpc("attribuer_role", { p_auteur: { type: "systeme", nom: "test e2e 9.12" }, p_compte: id, p_role: role });
      if (r.error) throw new Error(`rôle : ${r.error.message}`);
    }
    const lien = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (lien.error) throw new Error(`lien : ${lien.error.message}`);
    const jar = new Map<string, string>();
    const ssr = createServerClient(env.url, env.publique, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (liste) => liste.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
      },
    });
    const v = await ssr.auth.verifyOtp({ type: "magiclink", token_hash: lien.data.properties.hashed_token });
    if (v.error) throw new Error(`session : ${v.error.message}`);
    await page.context().addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", sameSite: "Lax" as const })));
  } catch (e) {
    await nettoyer();
    throw e;
  }
  return nettoyer;
}

test.describe("accueil visiteur à 375 px", () => {
  test("une colonne, sans défilement horizontal", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largeur).toBeLessThanOrEqual(375);
  });
});

// Retour du 2026-11-13 : un style propre à l'accueil restait appliqué après un clic (page précédente gardée en mémoire par Next.js) et le titre
// de la connexion passait sous le logo. Le parcours se fait par un vrai clic, à 1440 et 390 px.
for (const largeur of [1440, 390]) {
  test(`clic de l'accueil vers la connexion à ${largeur} px : en-tête visible, titre sous le logo, marges conservées`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/fr");
    await page.waitForLoadState("networkidle");
    const lien = page.locator('a[href="/fr/connexion"]:visible').first();
    if (await lien.count()) {
      await lien.click();
    } else {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Se connecter" }).click();
    }
    await expect(page).toHaveURL(/\/fr\/connexion$/);
    const titre = page.getByRole("heading", { level: 1 });
    await expect(titre).toBeVisible();
    const entete = page.locator("header").first();
    await expect(entete).toBeVisible();
    const logo = await entete.locator("a").first().boundingBox();
    const boite = await titre.boundingBox();
    expect(boite!.y).toBeGreaterThanOrEqual(logo!.y + logo!.height);
    // Le titre garde la marge du contenu (pas collé au bord gauche).
    expect(boite!.x).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}

test.describe("arrivées des personnes connectées", () => {
  test.describe.configure({ timeout: 180_000, mode: "serial" });
  const env = lireEnv();

  test("client : /fr reste l'accueil public (option A) ; espace personnel ouvert par /compte, blocs vides avec message et lien ; captures 1440 et 375", async ({ page }) => {
    test.skip(!env, "Variables Supabase absentes : aucun Compte TEST_ ne peut être créé.");
    mkdirSync(DOSSIER, { recursive: true });
    const nettoyer = await connecterCompteTest(page, env!);
    try {
      await page.goto("/fr");
      await expect(page).toHaveURL(/\/fr$/);
      await page.goto("/fr/compte");
      await expect(page).toHaveURL(/\/fr\/compte$/);
      await expect(page.getByRole("heading", { level: 1, name: "Bonjour TEST Espace" })).toBeVisible();
      for (const titre of ["Mes commandes", "Mes kits", "Mes Pass", "Mes événements", "Accès rapides", "Découvrir la boutique"]) {
        await expect(page.getByRole("heading", { level: 2, name: titre })).toBeVisible();
      }
      await expect(page.getByText("Tu n'as pas encore de commande.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Envoyer une photo" })).toBeVisible();
      const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(largeur).toBeLessThanOrEqual(375);
      await page.screenshot({ path: join(DOSSIER, "espace-375.png"), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.screenshot({ path: join(DOSSIER, "espace-1440.png"), fullPage: true });
      // Les pages publiques restent ouvertes à une personne connectée.
      expect((await page.goto("/fr/cosplays"))?.status()).toBe(200);
      await expect(page).toHaveURL(/\/fr\/cosplays$/);
    } finally {
      await nettoyer();
    }
  });

  test("admin : la connexion sans retour mène à /fr/admin ; « Voir le site » ne boucle pas", async ({ page }) => {
    test.skip(!env, "Variables Supabase absentes : aucun Compte TEST_ ne peut être créé.");
    const nettoyer = await connecterCompteTest(page, env!, "admin");
    try {
      await page.goto("/fr/connexion");
      await expect(page).toHaveURL(/\/fr\/admin$/);
      await expect(page.getByRole("navigation", { name: "Administration" }).first()).toBeAttached();
      expect((await page.goto("/fr/cosplays"))?.status()).toBe(200);
      await expect(page).toHaveURL(/\/fr\/cosplays$/);
      // Retour précis : il passe avant l'arrivée par défaut.
      await page.goto("/fr/connexion?retour=%2Ffr%2Fpanier");
      await expect(page).toHaveURL(/\/fr\/panier$/);
    } finally {
      await nettoyer();
    }
  });
});
