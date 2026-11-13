import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// Story 9.12 : accueils selon la connexion. Captures 1440 px de l'accueil visiteur (clair et sombre) placées à côté de la maquette
// (docs/design/maquette-accueil/), espace personnel d'un client TEST_ (1440 et 375 px), arrivée de l'admin à la connexion.
// Les captures vont dans docs/captures-accueil/ (outil local, jamais commité). Comptes TEST_ créés par l'API d'administration de Supabase,
// supprimés à la fin (aucune donnée TEST_ laissée sur la base) ; aucun paiement ni statut simulé (règle 13).

const DOSSIER = join(process.cwd(), "docs", "captures-accueil");
const MAQUETTE = join(process.cwd(), "docs", "design", "maquette-accueil");

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

async function poserTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("ks-theme", t);
    } catch {
      // Stockage indisponible : l'attribut suffit.
    }
  }, theme);
}

// Capture et maquette côte à côte, à la même échelle, dans une seule image.
async function coteACote(page: Page, capture: Buffer, maquette: string, sortie: string) {
  const enLigne = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;
  await page.setViewportSize({ width: 1440, height: 470 });
  await page.setContent(
    `<body style="margin:0;display:flex;gap:8px;background:#888"><img style="width:716px" src="${enLigne(capture)}"><img style="width:716px" src="${enLigne(readFileSync(join(MAQUETTE, maquette)))}"></body>`,
  );
  await page.screenshot({ path: join(DOSSIER, sortie) });
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

test.describe("accueil visiteur : maquette « fusion » à 1440 px", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  test.describe.configure({ timeout: 120_000 });

  for (const [theme, maquette] of [
    ["light", "fusion-creme.png"],
    ["dark", "fusion-sombre.png"],
  ] as const) {
    test(`capture ${theme} à côté de ${maquette}`, async ({ page }) => {
      mkdirSync(DOSSIER, { recursive: true });
      await poserTheme(page, theme);
      const reponse = await page.goto("/fr");
      expect(reponse?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const capture = await page.screenshot();
      writeFileSync(join(DOSSIER, `visiteur-1440-${theme}.png`), capture);
      await coteACote(page, capture, maquette, `cote-a-cote-${theme}.png`);
    });
  }

  test("bouton rond « compte » : à droite du Panier, clavier, Échap ferme et rend le focus", async ({ page }) => {
    await page.goto("/fr");
    const bouton = page.getByRole("button", { name: "Se connecter" });
    await expect(bouton).toBeVisible();
    const panier = await page.locator(".lien-panier").boundingBox();
    const rond = await bouton.boundingBox();
    expect(rond!.x).toBeGreaterThan(panier!.x);
    expect(rond!.width).toBeGreaterThanOrEqual(44);
    await bouton.focus();
    await page.keyboard.press("Enter");
    await expect(bouton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Thème sombre" })).toBeVisible();
    await expect(page.getByRole("link", { name: "English" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(bouton).toHaveAttribute("aria-expanded", "false");
    await expect(bouton).toBeFocused();
  });
});

test.describe("accueil visiteur à 375 px", () => {
  test("une colonne, sans défilement horizontal", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largeur).toBeLessThanOrEqual(375);
  });
});

test.describe("arrivées des personnes connectées", () => {
  test.describe.configure({ timeout: 180_000, mode: "serial" });
  const env = lireEnv();

  test("client : /fr mène à son espace personnel ; blocs vides avec message et lien ; captures 1440 et 375", async ({ page }) => {
    test.skip(!env, "Variables Supabase absentes : aucun Compte TEST_ ne peut être créé.");
    mkdirSync(DOSSIER, { recursive: true });
    const nettoyer = await connecterCompteTest(page, env!);
    try {
      await page.goto("/fr");
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
