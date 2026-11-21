import { createServerClient } from "@supabase/ssr";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { connecterCompteTest, lireEnv, service, type Env } from "./police-outils";

// Story 9.17 : page de connexion selon connexion.mp4. En-tête réduit (logo, thème, langue, trait), aucun menu, ni « Se connecter », ni panier,
// aucun pied de page ; panneau d'images en fondu à gauche (masqué sous 768 px) ; les autres pages gardent l'en-tête et le pied du site.
test.describe("page de connexion selon la maquette (9.17)", () => {
  test("1366 px : en-tête réduit, panneau d'images, carte, aucun menu ni pied de page", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/fr/connexion?retour=/fr/cosplays", { waitUntil: "networkidle" });
    const entete = page.locator("[data-entete-connexion]");
    await expect(entete).toBeVisible();
    await expect(entete.getByRole("link", { name: /.+/ }).first()).toHaveAttribute("href", "/fr");
    await expect(entete.getByRole("button", { name: /Thème/ })).toBeVisible();
    // Seul moyen de changer de langue sur cette page : il garde la requête (retour).
    await expect(entete.getByRole("link", { name: "English" })).toHaveAttribute("href", /\/en\/connexion\?retour=/);
    // Ni menu, ni « Se connecter », ni panier, ni pied de page (l'en-tête et le pied du site sont retirés).
    await expect(page.getByRole("button", { name: "Boutique" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Blog", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Se connecter" })).toHaveCount(0);
    for (const nom of ["Festival", "À propos"]) await expect(page.getByRole("link", { name: nom, exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Panier/ })).toHaveCount(0);
    await expect(page.locator(".entete-collant")).toBeHidden();
    await expect(page.locator("footer.pied-site")).toBeHidden();
    // Panneau : images en fondu, une seule exposée (« Illustration »).
    const panneau = page.locator("[data-panneau-connexion]");
    await expect(panneau).toBeVisible();
    await expect(panneau.getByRole("img", { name: "Illustration" })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await expect(page.getByLabel("Adresse email")).toBeVisible();
  });

  test("le fondu passe à l'image suivante en 3 s environ ; « réduire les animations » : image fixe", async ({ page, browser }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/fr/connexion", { waitUntil: "networkidle" });
    // Sans dépendre du moment de l'hydratation : l'image visible change en 3 s environ (6 s au plus).
    const visible = () => page.locator("[data-panneau-connexion] [data-visible]").getAttribute("data-diapo");
    const depart = await visible();
    await expect.poll(visible, { timeout: 6_000 }).not.toBe(depart);

    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1366, height: 768 } });
    try {
      const fixe = await ctx.newPage();
      await fixe.goto("/fr/connexion", { waitUntil: "networkidle" });
      // Pas de bouton Pause : rien ne défile ; l'image reste la première au-delà d'un intervalle.
      await expect(fixe.locator("[data-panneau-connexion]").getByRole("button")).toHaveCount(0);
      await fixe.waitForTimeout(3_500);
      expect(await fixe.locator("[data-panneau-connexion] [data-visible]").getAttribute("data-diapo")).toBe("0");
    } finally {
      await ctx.close();
    }
  });

  test("390 px : panneau masqué, champ email visible sans défiler, aucun défilement horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fr/connexion", { waitUntil: "networkidle" });
    await expect(page.locator("[data-panneau-connexion]")).toBeHidden();
    await expect(page.getByLabel("Adresse email")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Rien ne dépasse de la carte (le bouton Google peut passer à la ligne sous 768 px).
    const carte = (await page.locator("[data-carte-connexion]").boundingBox())!;
    for (const element of [page.getByLabel("Adresse email"), page.getByRole("button", { name: "Continuer avec Google" })]) {
      const b = (await element.boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(carte.x + carte.width);
    }
  });

  test("une autre page garde l'en-tête et le pied de page du site", async ({ page }) => {
    await page.goto("/fr", { waitUntil: "networkidle" });
    await expect(page.locator(".entete-collant")).toBeVisible();
    await expect(page.locator("footer.pied-site")).toBeVisible();
  });
});

// Correction 9.17 (spec-9-17-connexion-maquette-2) : proportions de docs/references/maquettes-admin/connexion-reference.png, mesurées par Jonathan
// en % de la largeur de la fenêtre. Marge gauche 3,2 %, panneau 46,3 %, carte 38,6 %, marge droite 6,8 % ; en-tête 50 px ; panneau de
// (en-tête + 16) à (bas − 22) ; carte centrée verticalement sur le panneau (±2 px) ; aucun défilement.
type Mesures = {
  largeur: number;
  hauteur: number;
  entete: { haut: number; bas: number };
  panneau: { gauche: number; droite: number; haut: number; bas: number };
  carte: { gauche: number; droite: number; haut: number; bas: number };
  defilementVertical: boolean;
  defilementHorizontal: boolean;
};

async function mesurer(page: Page): Promise<Mesures> {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const boite = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return { gauche: r.left, droite: r.right, haut: r.top, bas: r.bottom };
    };
    const e = document.querySelector("[data-entete-connexion]")!.getBoundingClientRect();
    return {
      largeur: window.innerWidth,
      hauteur: window.innerHeight,
      entete: { haut: e.top, bas: e.bottom },
      panneau: boite("[data-panneau-connexion]"),
      carte: boite("[data-carte-connexion]"),
      defilementVertical: document.documentElement.scrollHeight > window.innerHeight,
      defilementHorizontal: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

function verifierProportions(m: Mesures) {
  const pres = (reel: number, attendu: number, quoi: string) =>
    expect(Math.abs(reel - attendu), `${quoi} : ${reel} au lieu de ${attendu}`).toBeLessThanOrEqual(2);
  const W = m.largeur;
  pres(m.entete.bas - m.entete.haut, 50, "hauteur de l'en-tête");
  pres(m.panneau.gauche, 0.032 * W, "marge gauche");
  pres(m.panneau.droite - m.panneau.gauche, 0.463 * W, "largeur du panneau");
  pres(m.carte.gauche - m.panneau.droite, 0.051 * W, "écart");
  pres(m.carte.droite - m.carte.gauche, 0.386 * W, "largeur de la carte");
  pres(W - m.carte.droite, 0.068 * W, "marge droite");
  pres(m.panneau.haut, m.entete.bas + 16, "haut du panneau");
  pres(m.panneau.bas, m.hauteur - 22, "bas du panneau");
  pres((m.carte.haut + m.carte.bas) / 2, (m.panneau.haut + m.panneau.bas) / 2, "centre vertical de la carte");
  expect(m.defilementVertical, "défilement vertical").toBe(false);
  expect(m.defilementHorizontal, "défilement horizontal").toBe(false);
}

test.describe("connexion aux proportions de la capture de référence (9.17, correction)", () => {
  for (const [largeur, hauteur] of [
    [1024, 768],
    [1108, 643],
    [1366, 768],
    [1920, 1080],
  ]) {
    test(`${largeur} × ${hauteur} : marges, panneau, carte et en-tête aux mesures de la référence, aucun défilement`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.goto("/fr/connexion", { waitUntil: "networkidle" });
      const m = await mesurer(page);
      verifierProportions(m);
      // Bouton Google sur une ligne, dans la carte.
      const bouton = (await page.getByRole("button", { name: "Continuer avec Google" }).boundingBox())!;
      expect(bouton.height).toBeLessThanOrEqual(48);
      expect(bouton.x + bouton.width).toBeLessThanOrEqual(m.carte.droite);
    });
  }

  for (const largeur of [768, 800, 900]) {
    test(`${largeur} px (entre 768 et 1023) : carte d'au moins 392 px, bouton Google sur une seule ligne dans la carte, aucun défilement horizontal`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 768 });
      await page.goto("/fr/connexion", { waitUntil: "networkidle" });
      const m = await mesurer(page);
      expect(m.carte.droite - m.carte.gauche).toBeGreaterThanOrEqual(390);
      expect(m.carte.gauche).toBeGreaterThan(m.panneau.droite);
      expect(m.defilementHorizontal).toBe(false);
      const google = page.getByRole("button", { name: "Continuer avec Google" });
      const rendu = await google.evaluate((b) => ({ nowrap: getComputedStyle(b).whiteSpace === "nowrap", deborde: b.scrollWidth > b.clientWidth + 1 }));
      expect(rendu).toEqual({ nowrap: true, deborde: false });
      // Le bouton reste dans la carte.
      const bouton = (await google.boundingBox())!;
      expect(bouton.x + bouton.width).toBeLessThanOrEqual(m.carte.droite);
    });
  }

  test("champ email : fond sombre en thème sombre seulement, fond crème en thème clair", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/fr/connexion", { waitUntil: "networkidle" });
    const fond = () => page.getByLabel("Adresse email").evaluate((c) => getComputedStyle(c).backgroundColor);
    const fondCarte = () => page.locator("[data-carte-connexion]").evaluate((c) => getComputedStyle(c).backgroundColor);
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    expect(await fond()).toBe(await fondCarte());
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    // Fond de la page en thème sombre (#16130f), plus foncé que la carte.
    expect(await fond()).toBe("rgb(22, 19, 15)");
  });
});

// Tous les cas (demande de Jonathan, 2026-11-21) : la même page sert à tout le monde (clients, bénévoles, admin) et aussi d'inscription. Le panneau
// et la carte gardent leur place dans chaque cas.
async function panneauEtCarte(page: Page) {
  await expect(page.locator("[data-entete-connexion]")).toBeVisible();
  await expect(page.locator("[data-panneau-connexion]")).toBeVisible();
  await expect(page.locator("[data-carte-connexion]")).toBeVisible();
  const m = await mesurer(page);
  expect(m.carte.gauche).toBeGreaterThan(m.panneau.droite);
  expect(m.defilementHorizontal).toBe(false);
  return m;
}

// Compte TEST_ neuf (API d'administration), sans âge déclaré : la page de connexion ouvre l'étape de l'âge. Renvoie la suppression du Compte.
async function connecterCompteSansAge(page: Page, env: Env): Promise<() => Promise<void>> {
  const admin = service(env);
  const email = `test_917-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.invalid`;
  const cree = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: "TEST 9.17" } });
  if (cree.error || !cree.data.user) throw new Error(`création du Compte TEST_ impossible : ${cree.error?.message}`);
  const id = cree.data.user.id;
  const supprimer = async () => {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`suppression du Compte TEST_ impossible : ${error.message}`);
  };
  try {
    const lien = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (lien.error) throw new Error(`lien : ${lien.error.message}`);
    const jar = new Map<string, string>();
    const ssr = createServerClient(env.url, env.publique, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
      },
    });
    const v = await ssr.auth.verifyOtp({ type: "magiclink", token_hash: lien.data.properties.hashed_token });
    if (v.error) throw new Error(`session : ${v.error.message}`);
    await page.context().addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", sameSite: "Lax" as const })));
  } catch (e) {
    await supprimer();
    throw e;
  }
  return supprimer;
}

const BOITE = process.env.MAILPIT_URL?.replace(/\/+$/, "");
async function boiteJoignable(request: APIRequestContext) {
  if (!BOITE) return false;
  try {
    return (await request.get(`${BOITE}/api/v1/info`)).ok();
  } catch {
    return false;
  }
}

test.describe("connexion : même mise en page dans tous les cas (9.17, correction)", () => {
  // Mode dev : la première visite de chaque page compile avant de répondre.
  test.describe.configure({ timeout: 90_000 });
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test("« Se connecter » depuis l'accueil mène à la page avec le panneau et la carte", async ({ page }) => {
    await page.goto("/fr", { waitUntil: "networkidle" });
    await page.locator(".entete-collant").getByRole("link", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/fr\/connexion/);
    verifierProportions(await panneauEtCarte(page));
  });

  test("arrivée depuis la commande (?retour=) : retour à la commande après connexion", async ({ page }) => {
    const env = lireEnv();
    test.skip(!env, "Variables Supabase absentes (.env.local) : Compte TEST_ impossible à créer.");
    // Chemin réel : la page de commande renvoie un visiteur non connecté vers la connexion (PageCommande, versConnexion).
    await page.goto("/fr/commande", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/fr\/connexion\?retour=%2Ffr%2Fcommande$/);
    verifierProportions(await panneauEtCarte(page));
    const supprimer = await connecterCompteTest(page, env!, "test_917-");
    try {
      const visitees: string[] = [];
      page.on("request", (r) => {
        if (r.isNavigationRequest()) visitees.push(new URL(r.url()).pathname);
      });
      await page.reload({ waitUntil: "networkidle" });
      // Connecté : la connexion renvoie à /fr/commande ; un Panier vide y renvoie ensuite au Panier (PageCommande).
      expect(visitees).toContain("/fr/commande");
      await expect(page).not.toHaveURL(/\/connexion/);
    } finally {
      await supprimer();
    }
  });

  test("session expirée (?expiree=1) : bandeau visible, panneau et carte en place", async ({ page }) => {
    await page.goto("/fr/connexion?expiree=1", { waitUntil: "networkidle" });
    await expect(page.getByText("Ta session a expiré après une longue inactivité. Reconnecte-toi pour continuer.")).toBeVisible();
    verifierProportions(await panneauEtCarte(page));
  });

  test("retour de Google en échec (?erreur=google) : message, panneau et carte en place", async ({ page }) => {
    // Le vrai Google n'est pas simulé (règle 13) : seule l'adresse de retour en échec est ouverte.
    await page.goto("/fr/connexion?erreur=google", { waitUntil: "networkidle" });
    await expect(page.getByText("La connexion avec Google n'a pas abouti. Réessaie, ou utilise le code reçu par email.")).toBeVisible();
    verifierProportions(await panneauEtCarte(page));
  });

  test("/en/connexion : même mise en page", async ({ page }) => {
    await page.goto("/en/connexion", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    verifierProportions(await panneauEtCarte(page));
  });

  test("bouton thème : sombre puis clair", async ({ page }) => {
    await page.goto("/fr/connexion", { waitUntil: "networkidle" });
    const bouton = page.locator("[data-entete-connexion]").getByRole("button", { name: /Thème/ });
    const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    const depart = await theme();
    // Réessayé tant que la page n'est pas hydratée.
    await expect(async () => {
      await bouton.click();
      expect(await theme()).not.toBe(depart);
    }).toPass({ timeout: 10_000 });
    const second = await theme();
    await bouton.click();
    await expect.poll(theme).not.toBe(second);
    expect([second, await theme()].sort()).toEqual(["dark", "light"]);
  });

  test("étape de l'âge d'un Compte neuf : panneau visible, carte centrée", async ({ page }) => {
    const env = lireEnv();
    test.skip(!env, "Variables Supabase absentes (.env.local) : Compte TEST_ impossible à créer.");
    const supprimer = await connecterCompteSansAge(page, env!);
    try {
      await page.goto("/fr/connexion", { waitUntil: "networkidle" });
      await expect(page.getByLabel("Âge")).toBeVisible();
      verifierProportions(await panneauEtCarte(page));
    } finally {
      await supprimer();
    }
  });

  test("étape du code à 6 chiffres, puis aide ouverte : la carte grandit, rien ne se chevauche", async ({ page, request }) => {
    // L'envoi réel d'un code demande la boîte de test locale (Mailpit, CI) : aucun email n'est envoyé depuis koma-dev par ce test.
    const joignable = await boiteJoignable(request);
    if (process.env.CI) expect(joignable, "MAILPIT_URL absente ou boîte de test injoignable en CI").toBe(true);
    else test.skip(!joignable, "Boîte de test locale (Mailpit) absente : étape du code non atteinte sans envoi réel.");
    const email = `test-917-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    await page.goto("/fr/connexion", { waitUntil: "networkidle" });
    await expect(async () => {
      await page.getByLabel("Adresse email").fill(email);
      await page.getByRole("button", { name: "Recevoir un code" }).click();
      await expect(page.getByText(`Un code a été envoyé à ${email}.`)).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByLabel("Code à 6 chiffres")).toBeVisible();
    const avant = await panneauEtCarte(page);
    await page.locator("[data-carte-connexion] summary").click();
    await expect(page.locator("[data-carte-connexion] details")).toHaveAttribute("open", "");
    // Contenu haut : la carte grandit, la page peut défiler verticalement ; le panneau reste 16 px sous l'en-tête, la carte sous l'en-tête,
    // à droite du panneau, sans défilement horizontal.
    const apres = await panneauEtCarte(page);
    expect(apres.carte.bas - apres.carte.haut).toBeGreaterThan(avant.carte.bas - avant.carte.haut);
    expect(Math.abs(apres.panneau.haut - (apres.entete.bas + 16))).toBeLessThanOrEqual(2);
    expect(apres.carte.haut).toBeGreaterThanOrEqual(apres.entete.bas);
  });
});
