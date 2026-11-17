import { expect, test, type APIRequestContext } from "@playwright/test";
import { connecterCompteTest, lireEnv } from "./police-outils";

// Zone admin : un visiteur est envoyé vers la connexion avec le chemin de retour ; un Compte sans rôle voit la 404.
// Le test d'un admin connecté demande un Compte réel avec le rôle admin : il se fait à la main (README, « Premier admin »),
// aucun rôle n'est simulé ici (règle 13).
const BOITE = process.env.MAILPIT_URL?.replace(/\/+$/, "");

test.describe("accès admin", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const [chemin, retour] of [
    ["/fr/admin", "%2Ffr%2Fadmin"],
    ["/fr/admin/reglages", "%2Ffr%2Fadmin%2Freglages"],
    ["/en/admin/reglages", "%2Fen%2Fadmin%2Freglages"],
    ["/fr/admin/messages", "%2Ffr%2Fadmin%2Fmessages"],
    ["/en/admin/messages", "%2Fen%2Fadmin%2Fmessages"],
    ["/fr/admin/taches", "%2Ffr%2Fadmin%2Ftaches"],
    ["/en/admin/taches", "%2Fen%2Fadmin%2Ftaches"],
    ["/fr/admin/produits", "%2Ffr%2Fadmin%2Fproduits"],
    ["/en/admin/produits", "%2Fen%2Fadmin%2Fproduits"],
    ["/fr/admin/produits/nouveau", "%2Ffr%2Fadmin%2Fproduits%2Fnouveau"],
    ["/fr/admin/produits/00000000-0000-4000-8000-000000000000", "%2Ffr%2Fadmin%2Fproduits%2F00000000-0000-4000-8000-000000000000"],
    ["/fr/admin/univers", "%2Ffr%2Fadmin%2Funivers"],
    ["/en/admin/univers", "%2Fen%2Fadmin%2Funivers"],
  ] as const) {
    test(`visiteur sur ${chemin} : envoyé vers la connexion avec retour`, async ({ page }) => {
      await page.goto(chemin);
      await expect(page).toHaveURL(new RegExp(`/${chemin.slice(1, 3)}/connexion\\?retour=${retour}$`));
      // Aucune navigation admin n'a été montrée.
      await expect(page.getByRole("navigation", { name: "Administration" })).toHaveCount(0);
    });
  }

  test("la page admin n'est pas indexable et robots.txt l'exclut", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /fr/admin");
    expect(robots).toContain("Disallow: /en/admin");
  });
});

async function boiteJoignable(request: APIRequestContext) {
  if (!BOITE) return false;
  try {
    return (await request.get(`${BOITE}/api/v1/info`)).ok();
  } catch {
    return false;
  }
}

test.describe("accès admin : Compte sans rôle", () => {
  test.describe.configure({ timeout: 120_000 });

  test("un Compte connecté sans rôle admin voit la 404, pas l'admin", async ({ page, request }) => {
    const joignable = await boiteJoignable(request);
    if (process.env.CI) expect(joignable, "MAILPIT_URL absente ou boîte de test injoignable en CI").toBe(true);
    else test.skip(!joignable, "Boîte de test locale (Mailpit) absente : un vrai Compte ne peut pas être créé sur koma-dev sans lire son code.");

    const email = `test-admin-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    await page.goto("/fr/connexion");
    await expect(async () => {
      await page.getByLabel("Adresse email").fill(email);
      await page.getByRole("button", { name: "Recevoir un code" }).click();
      await expect(page.getByText(`Un code a été envoyé à ${email}.`)).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 20_000 });

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

    await page.getByLabel("Code à 6 chiffres").fill(code);
    await page.getByRole("button", { name: "Valider le code" }).click();
    await page.getByLabel("Âge").fill("25");
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Passer" }).click();

    for (const chemin of ["/fr/admin", "/en/admin/reglages", "/fr/admin/produits", "/fr/admin/produits/nouveau", "/en/admin/univers"]) {
      await page.goto(chemin);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Page introuvable|Page not found/);
      await expect(page.getByRole("navigation", { name: "Administration" })).toHaveCount(0);
    }
  });
});

// Story 9.16 c) : tableau de bord selon la maquette. Comptes TEST_ réels (API d'administration), rôle attribué par la fonction existante,
// supprimés à la fin ; aucune donnée de boutique créée, aucun paiement simulé (règle 13).
const env = lireEnv();

test.describe("tableau de bord (9.16 c)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("l'Admin voit les 4 cartes, le graphique des 30 jours, Performance du jour et les deux « Voir plus »", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916c-admin-", "admin");
    try {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto("/fr/admin");
      for (const libelle of ["Produits publiés", "Commandes au total", "Revenu total", "Paiements réussis"]) {
        await expect(page.getByText(libelle, { exact: true })).toBeVisible();
      }
      await expect(page.getByRole("heading", { name: "Performance des ventes" })).toBeVisible();
      await expect(page.locator("[data-barre]")).toHaveCount(30);
      await expect(page.getByRole("heading", { name: "Performance du jour" })).toBeVisible();
      await expect(page.getByText(/^Ventes du \d{2}\/\d{2}\/\d{4} :$/)).toBeVisible();
      await expect(page.getByRole("link", { name: "Voir plus (toutes les tâches)" })).toHaveAttribute("href", "/fr/admin/taches");
      const versIndicateurs = page.getByRole("link", { name: "Voir plus (tous les indicateurs)" });
      await expect(versIndicateurs).toHaveAttribute("href", "#indicateurs");
      await versIndicateurs.click();
      await expect(page.getByRole("heading", { level: 2, name: "Tous les indicateurs" })).toBeInViewport();
      // Rien de l'existant n'a disparu : sélecteur de période, toutes les tâches.
      await expect(page.getByRole("group", { name: "Période des graphiques et des commandes payées" })).toBeAttached();
      await expect(page.getByRole("heading", { level: 2, name: "Toutes les tâches" })).toBeAttached();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      await supprimer();
    }
  });

  test("un Assistant voit toujours la 404 sur le tableau de bord", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916c-assistant-", "assistant");
    try {
      await page.goto("/fr/admin");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Page introuvable/);
      await expect(page.getByText("Produits publiés", { exact: true })).toHaveCount(0);
    } finally {
      await supprimer();
    }
  });
});
