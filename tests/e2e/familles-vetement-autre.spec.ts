import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

// Story 9.15 : familles « Vêtement » et « Autre article ». Données TEST_ créées sur la base de .env.local (koma-dev en local, base locale en CI)
// par la Supabase CLI (SQL avec les droits du propriétaire, auteur « systeme » journalisé), photos de démonstration dessinées ici (aucune image
// tierce), Compte TEST_ créé par l'API d'administration ; TOUT est supprimé à la fin, même en cas d'échec, puis compté (0 attendu partout).
// Aucun paiement, aucune notification ni aucun statut simulé (règle 13) : la Commande TEST_ reste « en attente », on ne lance jamais le paiement.

const AUTEUR = `{"type":"systeme","nom":"e2e 9.15 TEST"}`;
const ID = { polo: "00000000-0000-4000-8915-000000000001", objet: "00000000-0000-4000-8915-000000000002" };
const SLUG = { polo: "test-e2e-915-polo", objet: "test-e2e-915-objet" };
const TITRE = { polo: "TEST_ Polo e2e", poloEn: "TEST_ Polo e2e EN", objet: "TEST_ Objet e2e", objetEn: "TEST_ Object e2e" };
const FICHIERS = ["test-e2e-915/polo.jpg", "test-e2e-915/objet.jpg"];
const EMAIL_PREFIXE = "test-e2e-915-";

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

const env = lireEnv();
test.skip(!env, "variables Supabase absentes");

// SQL exécuté par la Supabase CLI : base liée (koma-dev) en local, base locale en CI (la CI fait déjà `supabase start`).
// `--local` n'accepte qu'UNE commande par appel (requête préparée) : chaque écriture est donc un seul bloc `do $$ … $$`,
// qui reste une seule transaction (auteur journalisé et déclencheur désactivé le temps du bloc). La sortie texte de la CLI
// n'est jamais lue : les lectures passent par le client Supabase (clé service), identique en local et en CI.
function sql(requete: string): void {
  const dossier = mkdtempSync(join(tmpdir(), "e2e-915-"));
  const fichier = join(dossier, "requete.sql");
  writeFileSync(fichier, requete);
  const r = spawnSync("npx", ["supabase", "db", "query", process.env.CI ? "--local" : "--linked", "-f", fichier], { encoding: "utf8", shell: true });
  rmSync(dossier, { recursive: true, force: true });
  if (r.status !== 0 || /"error"|ERROR/.test(r.stdout + r.stderr)) throw new Error(`SQL en échec : ${(r.stdout + r.stderr).slice(0, 1200)}`);
}

// Un seul bloc PL/pgSQL : une seule commande pour la CLI, une seule transaction pour la base.
function sqlBloc(corps: string, declarations = ""): void {
  const declare = declarations ? [`declare`, declarations] : [];
  sql(["do $bloc$", ...declare, "begin", `perform set_config('ks.auteur', '${AUTEUR}', true);`, corps, "end", "$bloc$;"].join("\n"));
}

function service(): SupabaseClient {
  if (!env) throw new Error("variables Supabase absentes");
  return createClient(env.url, env.secrete, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function images() {
  const degrade = (a: string, b: string) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/></svg>`);
  return { [FICHIERS[0]]: await sharp(degrade("#3a3430", "#1c1916")).jpeg().toBuffer(), [FICHIERS[1]]: await sharp(degrade("#cdbfa6", "#8c7c62")).jpeg().toBuffer() };
}

// Comptes TEST_ de ce fichier (préfixe réservé), lus par l'API d'administration.
async function comptesTest(): Promise<string[]> {
  const { data, error } = await service().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`liste des Comptes : ${error.message}`);
  return data.users.filter((u) => (u.email ?? "").startsWith(EMAIL_PREFIXE)).map((u) => u.id);
}

// Nettoyage complet, dans l'ordre inverse de la création ; rejouable (aussi lancé avant de semer).
async function nettoyer() {
  const comptes = await comptesTest();
  const liste = comptes.length > 0 ? comptes.map((c) => `'${c}'`).join(",") : "null";
  const produits = `'${ID.polo}', '${ID.objet}'`;
  sqlBloc(`delete from public.reservation where commande_id in (select id from public.commande where compte_id in (${liste}))
  or commande_id in (select commande_id from public.ligne_commande where produit_id in (${produits}));
delete from public.tentative_paiement where commande_id in (select id from public.commande where compte_id in (${liste}));
delete from public.ligne_commande where produit_id in (${produits}) or commande_id in (select id from public.commande where compte_id in (${liste}));
delete from public.commande where compte_id in (${liste});
delete from public.ligne_panier where produit_id in (${produits}) or panier_id in (select id from public.panier where compte_id in (${liste}));
delete from public.panier where compte_id in (${liste});
alter table public.produit disable trigger produit_publie_complet;
delete from public.produit_photo where produit_id in (${produits});
delete from public.variante where produit_id in (${produits});
delete from public.produit where id in (${produits}) or slug like 'test-e2e-915-%';
alter table public.produit enable trigger produit_publie_complet;`);
  await service().storage.from("produits-public").remove(FICHIERS);
  for (const id of comptes) {
    const { error } = await service().auth.admin.deleteUser(id);
    if (error) throw new Error(`suppression du Compte TEST_ impossible : ${error.message}`);
  }
}

// Contrôle final : aucune donnée TEST_ de ce fichier ne reste. Comptes exacts lus par le client Supabase (clé service).
async function compterRestes(): Promise<Record<string, number>> {
  const ids = [ID.polo, ID.objet];
  const compter = async (table: string, colonne: string, slug = false): Promise<number> => {
    let requete = service().from(table).select("*", { count: "exact", head: true });
    requete = slug ? requete.or(`id.in.(${ids.join(",")}),slug.like.test-e2e-915-%`) : requete.in(colonne, ids);
    const { count, error } = await requete;
    if (error || count === null) throw new Error(`comptage de ${table} impossible : ${error?.message}`);
    return count;
  };
  const { data } = await service().storage.from("produits-public").list("test-e2e-915");
  return {
    produits: await compter("produit", "id", true),
    variantes: await compter("variante", "produit_id"),
    photos: await compter("produit_photo", "produit_id"),
    lignes_panier: await compter("ligne_panier", "produit_id"),
    lignes_commande: await compter("ligne_commande", "produit_id"),
    comptes: (await comptesTest()).length,
    fichiers: (data ?? []).length,
  };
}

// Vêtement publié : M et L × Noir et Blanc, stock seulement en M Noir (aucune fabrication sur commande) ; Autre article publié, Taille unique.
async function semer() {
  for (const [chemin, contenu] of Object.entries(await images())) {
    const { error } = await service().storage.from("produits-public").upload(chemin, contenu, { upsert: true, contentType: "image/jpeg" });
    if (error) throw new Error(`envoi de ${chemin} impossible : ${error.message}`);
  }
  sqlBloc(`alter table public.produit disable trigger produit_publie_complet;
insert into public.produit (id, famille, slug, titre_fr, titre_en, description_fr, description_en, prix_cents) values
  ('${ID.polo}', 'vetement', '${SLUG.polo}', '${TITRE.polo}', '${TITRE.poloEn}', 'TEST_ description de démonstration', 'TEST_ demo description', 2500),
  ('${ID.objet}', 'autre', '${SLUG.objet}', '${TITRE.objet}', '${TITRE.objetEn}', 'TEST_ description de démonstration', 'TEST_ demo description', 1200);
insert into public.produit_photo (produit_id, fichier, position, alt_fr, alt_en) values
  ('${ID.polo}', '${FICHIERS[0]}', 1, 'TEST_ photo de démonstration du polo', 'TEST_ demo photo of the polo shirt'),
  ('${ID.objet}', '${FICHIERS[1]}', 1, 'TEST_ photo de démonstration de l''objet', 'TEST_ demo photo of the object');
insert into public.variante (produit_id, taille, couleur_fr, couleur_en, couleur_hex, stock) values
  ('${ID.polo}', 'M', 'Noir', 'Black', '#1B1713', 5),
  ('${ID.polo}', 'L', 'Noir', 'Black', '#1B1713', 0),
  ('${ID.polo}', 'M', 'Blanc', 'White', '#F4EFE6', 0),
  ('${ID.polo}', 'L', 'Blanc', 'White', '#F4EFE6', 0);
insert into public.variante (produit_id, taille, stock) values ('${ID.objet}', 'unique', 2);
update public.produit set publie_le = now() - interval '1 hour' where id in ('${ID.polo}', '${ID.objet}');
alter table public.produit enable trigger produit_publie_complet;`);
}

// Compte TEST_ réel (API d'administration, âge déclaré, questions d'accueil passées) et sa session posée dans le navigateur.
async function connecter(page: Page): Promise<string> {
  if (!env) throw new Error("variables Supabase absentes");
  const admin = service();
  const email = `${EMAIL_PREFIXE}${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.invalid`;
  const cree = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: "TEST Vetement" } });
  if (cree.error || !cree.data.user) throw new Error(`création du Compte TEST_ impossible : ${cree.error?.message}`);
  const id = cree.data.user.id;
  const age = await admin.rpc("declarer_age", { p_auteur: { type: "systeme", nom: "e2e 9.15 TEST" }, p_compte: id, p_age: 25 });
  if (age.error) throw new Error(`âge : ${age.error.message}`);
  const q = await admin.rpc("enregistrer_questions_accueil", { p_auteur: { type: "compte", id, role: null }, p_compte: id, p_origine: null, p_preference: null });
  if (q.error) throw new Error(`questions : ${q.error.message}`);
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
  return id;
}

async function violationsGraves(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

const sansDefilement = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe.configure({ mode: "serial" });

test.describe("story 9.15 : Vêtement et Autre article", () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    await nettoyer();
    await semer();
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    try {
      await nettoyer();
    } finally {
      const restes = await compterRestes();
      console.log(`[e2e 9.15] données TEST_ restantes : ${JSON.stringify(restes)}`);
      expect(restes).toEqual({ produits: 0, variantes: 0, photos: 0, lignes_panier: 0, lignes_commande: 0, comptes: 0, fichiers: 0 });
    }
  });

  for (const [adresse, titre] of [
    ["/fr/vetements", TITRE.polo],
    ["/en/clothing", TITRE.poloEn],
    ["/fr/autres-articles", TITRE.objet],
    ["/en/other-items", TITRE.objetEn],
  ] as const) {
    test(`${adresse} liste le produit TEST_`, async ({ page }) => {
      const reponse = await page.goto(adresse, { waitUntil: "networkidle" });
      expect(reponse?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 3, name: titre })).toBeVisible();
      expect(await sansDefilement(page)).toBe(true);
    });
  }

  test("fiche du Vêtement : couleur puis taille, combinaison sans stock, ajout, panier avec taille et couleur, carte jamais chez Polar", async ({ page }) => {
    test.setTimeout(120_000);
    await connecter(page);
    await page.goto(`/fr/vetements/${SLUG.polo}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: TITRE.polo })).toBeVisible();
    const couleurs = page.getByRole("group", { name: "Couleur" });
    await expect(couleurs.getByRole("radio")).toHaveCount(2);

    // Blanc : aucune taille ne s'achète dans cette couleur (stock à zéro, sans fabrication sur commande).
    await couleurs.getByText("Blanc", { exact: true }).click();
    await expect(page.getByText("Plus en stock pour le moment")).toBeVisible();
    await expect(page.getByRole("group", { name: "Taille" })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("Épuisé");

    // Noir puis M : la combinaison en stock s'ajoute au panier.
    await couleurs.getByText("Noir", { exact: true }).click();
    const tailles = page.getByRole("group", { name: "Taille" });
    await expect(tailles.getByRole("radio")).toHaveCount(1);
    await tailles.getByText("M", { exact: true }).click();
    await expect(tailles.getByRole("status")).toContainText("En stock");
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ajouté au panier" })).toBeVisible();

    await page.goto("/fr/panier", { waitUntil: "networkidle" });
    await expect(page.locator("main")).toContainText(TITRE.polo);
    await expect(page.locator("main")).toContainText("Taille : M · Noir");

    // Étape de paiement d'une Commande en attente du Compte TEST_ (créée en base, jamais payée) : la carte ne passe jamais par Polar.
    const [compte] = await comptesTest();
    sqlBloc(
      `insert into public.commande (compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, zone, mode_remise, telephone, expire_le)
  values ('${compte}', 'produits', 'en_attente', 2500, 2500, 0, 'goma', 'retrait', '+243990000000', now() + interval '30 minutes')
  returning id into v_commande;
insert into public.ligne_commande (commande_id, produit_id, variante_id, origine, nombre, prix_cents)
  select v_commande, '${ID.polo}', v.id, 'stock', 1, 2500 from public.variante v
  where v.produit_id = '${ID.polo}' and v.taille = 'M' and v.couleur_fr = 'Noir';`,
      "v_commande uuid;",
    );
    const lue = await service().from("commande").select("numero").eq("compte_id", compte).eq("statut", "en_attente").maybeSingle();
    const numero = lue.data?.numero as string | undefined;
    expect(numero, lue.error?.message ?? "Commande TEST_ introuvable").toMatch(/^KS-[0-9]{4}-[0-9]+$/);
    await page.goto(`/fr/commande/${numero}`, { waitUntil: "networkidle" });
    const main = page.locator("main");
    await expect(main.getByText("Carte", { exact: true })).toBeVisible();
    await expect(main).toContainText("Taille : M · Noir");
    // Ni dans le choix ni dans « Paiement traité par … » : Polar n'est jamais proposé pour un Vêtement (règle 10). Le pied de page n'est pas lu.
    await expect(main).not.toContainText("Polar");
    const traitePar = await main.getByText(/Paiement traité par/).allTextContents();
    for (const t of traitePar) expect(t).not.toMatch(/Polar/i);
    const carteDisponible = (await main.getByText("Le paiement par carte n'est pas disponible pour le moment.").count()) === 0;
    if (carteDisponible) expect(traitePar.some((t) => /MaishaPay/.test(t))).toBe(true);
    // Le paiement n'est jamais lancé : aucun clic sur « Payer ».
  });

  test("fiche de l'Autre article : aucun sélecteur de taille ni de couleur", async ({ page }) => {
    await page.goto(`/fr/autres-articles/${SLUG.objet}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: TITRE.objet })).toBeVisible();
    await expect(page.locator("main").getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Taille" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Couleur" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ajouter au panier" })).toBeVisible();
  });

  // Depuis 9.16 a, les liens de l'en-tête commencent à 1280 px ; à 1024 px, ils sont dans le menu ☰.
  test("en-tête à 1024 px : menu ☰, pas de bouton « Boutique » dans la barre, aucun défilement horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/fr/vetements", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeVisible();
    // getByRole ignore les éléments cachés : 0 bouton « Boutique » visible tant que le menu ☰ est fermé.
    await expect(page.locator("header").getByRole("button", { name: "Boutique" })).toHaveCount(0);
    expect(await sansDefilement(page)).toBe(true);
  });

  test("menu « Boutique » de l'en-tête à 1280 px : ouverture, cinq liens, Échap ; aucun défilement horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/fr/vetements", { waitUntil: "networkidle" });
    expect(await sansDefilement(page)).toBe(true);
    const bouton = page.getByRole("button", { name: "Boutique" });
    await expect(bouton).toHaveAttribute("aria-expanded", "false");
    await bouton.click();
    await expect(bouton).toHaveAttribute("aria-expanded", "true");
    const panneau = page.locator(`[id="${await bouton.getAttribute("aria-controls")}"]`);
    await expect(panneau.getByRole("link")).toHaveText(["Cosplays", "Accessoires", "Vêtements", "Autres articles", "Kits"]);
    expect(await sansDefilement(page)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(bouton).toHaveAttribute("aria-expanded", "false");
    await expect(bouton).toBeFocused();
  });

  for (const [nom, adresse] of [
    ["fiche du Vêtement", `/fr/vetements/${SLUG.polo}`],
    ["catalogue /fr/vetements", "/fr/vetements"],
  ] as const) {
    test(`axe : aucune violation serious ou critical sur la ${nom}`, async ({ page }) => {
      await page.goto(adresse, { waitUntil: "networkidle" });
      expect(await violationsGraves(page)).toEqual([]);
    });
  }
});
