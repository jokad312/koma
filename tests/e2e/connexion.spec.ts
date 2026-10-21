import { expect, test, type APIRequestContext } from "@playwright/test";

// Le code de connexion est lu dans la boîte de test de la base Supabase locale (Mailpit), jamais dans le site.
// Sur koma-dev (en ligne), cette boîte n'existe pas : les tests sont ignorés avec la raison écrite.
const BOITE = process.env.MAILPIT_URL?.replace(/\/+$/, "");

async function boiteJoignable(request: APIRequestContext) {
  if (!BOITE) return false;
  try {
    return (await request.get(`${BOITE}/api/v1/info`)).ok();
  } catch {
    return false;
  }
}

async function lireCode(request: APIRequestContext, email: string, ancien?: string): Promise<string> {
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
        // Après un second envoi à la même adresse, on attend le nouveau message.
        return code === ancien ? "" : code;
      },
      { timeout: 20_000, message: "le code n'est pas arrivé dans la boîte de test" },
    )
    .toMatch(/^\d{6}$/);
  return code;
}

function emailDeTest() {
  return `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

test.describe("connexion par code email", () => {
  test.beforeEach(async ({ request }) => {
    const joignable = await boiteJoignable(request);
    // En CI, la boîte de test doit exister : on échoue au lieu de sauter en silence.
    if (process.env.CI) expect(joignable, "MAILPIT_URL absente ou boîte de test injoignable en CI").toBe(true);
    else test.skip(!joignable, "Boîte de test locale (Mailpit) absente : variable MAILPIT_URL non définie ou injoignable (cas de koma-dev en ligne).");
  });

  test("crée un Compte, déclare l'âge, revient à la page quittée et se déconnecte", async ({ page, request }) => {
    const email = emailDeTest();
    // Le retour part d'une page localisée qui n'est pas l'accueil (/en/page-quittee : la 404 localisée, seule autre page existante).
    await page.goto("/en/connexion?retour=/en/page-quittee");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Get a code" }).click();
    await expect(page.getByText(`A code was sent to ${email}.`)).toBeVisible();

    // Un code faux est refusé et relié au champ.
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Confirm the code" }).click();
    await expect(page.getByText("This code is not correct. Check it or ask for a new code.")).toBeVisible();

    await page.getByLabel("6-digit code").fill(await lireCode(request, email));
    await page.getByRole("button", { name: "Confirm the code" }).click();

    await page.getByLabel("Age").fill("25");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/en\/page-quittee$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("connecté, /fr et /en s'affichent sans erreur de préparation à l'avance", async ({ page, request }) => {
    const email = emailDeTest();
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    page.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));

    await page.goto("/fr/connexion");
    await page.getByLabel("Adresse email").fill(email);
    await page.getByRole("button", { name: "Recevoir un code" }).click();
    await expect(page.getByText(`Un code a été envoyé à ${email}.`)).toBeVisible();
    await page.getByLabel("Code à 6 chiffres").fill(await lireCode(request, email));
    await page.getByRole("button", { name: "Valider le code" }).click();
    await page.getByLabel("Âge").fill("25");
    await page.getByRole("button", { name: "Continuer" }).click();

    for (const [chemin, deconnexion] of [["/fr", "Se déconnecter"], ["/en", "Sign out"]] as const) {
      const reponse = await page.goto(chemin);
      expect(reponse?.status()).toBe(200);
      await expect(page.getByRole("button", { name: deconnexion }).first()).toBeVisible();
      await expect(page.getByText(/unstable value|blocking-prerender-current-time/)).toHaveCount(0);
    }
    expect(erreurs.filter((e) => /Date\.now|prerender/i.test(e))).toEqual([]);
  });

  test("moins de 13 ans : Compte supprimé et message clair", async ({ page, request }) => {
    const email = emailDeTest();
    await page.goto("/fr/connexion");
    await page.getByLabel("Adresse email").fill(email);
    await page.getByRole("button", { name: "Recevoir un code" }).click();
    await expect(page.getByText(`Un code a été envoyé à ${email}.`)).toBeVisible();
    await page.getByLabel("Code à 6 chiffres").fill(await lireCode(request, email));
    await page.getByRole("button", { name: "Valider le code" }).click();

    await page.getByLabel("Âge").fill("12");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText(/Il faut avoir au moins 13 ans/)).toBeVisible();

    await page.goto("/fr");
    await expect(page.getByRole("link", { name: "Se connecter" }).first()).toBeVisible();

    // Preuve de la suppression : le même email recrée un nouveau Compte, donc l'étape âge revient.
    const premierCode = await lireCode(request, email);
    await page.goto("/fr/connexion");
    await page.getByLabel("Adresse email").fill(email);
    await page.getByRole("button", { name: "Recevoir un code" }).click();
    await expect(page.getByText(`Un code a été envoyé à ${email}.`)).toBeVisible();
    await page.getByLabel("Code à 6 chiffres").fill(await lireCode(request, email, premierCode));
    await page.getByRole("button", { name: "Valider le code" }).click();
    await expect(page.getByLabel("Âge")).toBeVisible();
  });
});

test("la page de connexion tient à 375 px sans défilement horizontal", async ({ page }) => {
  const reponse = await page.goto("/fr/connexion");
  expect(reponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(deborde).toBe(false);
});
