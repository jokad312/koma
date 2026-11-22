import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

// Bug A2 : filtre « univers » des catalogues, de bout en bout, sur les 5 familles. Données TEST_ créées sur la base de .env.local (koma-dev en
// local, base locale en CI) par la Supabase CLI (SQL avec les droits du propriétaire, auteur « systeme » journalisé) : deux univers TEST_ et,
// pour chaque famille, un produit TEST_ publié dans chacun (10 produits, Kits compris), photos de démonstration dessinées ici (aucune image
// tierce). TOUT est supprimé à la fin, même en cas d'échec, puis compté (0 attendu partout). Aucun Compte, aucun email : pas besoin de Mailpit.

const AUTEUR = `{"type":"systeme","nom":"e2e A2 TEST"}`;
const FAMILLES = [
  { famille: "cosplay", chemin: "/fr/cosplays", taille: "M" },
  { famille: "accessoire", chemin: "/fr/accessoires", taille: "M" },
  { famille: "vetement", chemin: "/fr/vetements", taille: "M" },
  { famille: "autre", chemin: "/fr/autres-articles", taille: "unique" },
  { famille: "kit", chemin: "/fr/kits", taille: null },
] as const;
type Famille = (typeof FAMILLES)[number]["famille"];

const UNIVERS = { A: "00000000-0000-4000-80a2-00000000aa01", B: "00000000-0000-4000-80a2-00000000aa02" } as const;
// UUID valide mais absent de la base, et valeur qui n'est pas un UUID (le filtre est alors ignoré).
const UNIVERS_INCONNU = "00000000-0000-4000-80a2-00000000ffff";
const UNIVERS_INVALIDE = "pas-un-uuid";
const NOM_UNIVERS = { A: "TEST_ Univers A e2e A2", B: "TEST_ Univers B e2e A2" } as const;

type Lettre = keyof typeof UNIVERS;
const LETTRES: readonly Lettre[] = ["A", "B"];
const produit = (famille: Famille, lettre: Lettre) => {
  const rang = FAMILLES.findIndex((f) => f.famille === famille) * 2 + (lettre === "A" ? 1 : 2);
  return {
    id: `00000000-0000-4000-80a2-0000000000${String(rang).padStart(2, "0")}`,
    slug: `test-e2e-a2-${famille}-${lettre.toLowerCase()}`,
    titre: `TEST_ ${famille} univers ${lettre} e2e A2`,
    fichier: `test-e2e-a2/${famille}-${lettre.toLowerCase()}.jpg`,
  };
};
const PRODUITS = FAMILLES.flatMap((f) => LETTRES.map((l) => ({ ...produit(f.famille, l), famille: f.famille, taille: f.taille, univers: UNIVERS[l] })));
const IDS_PRODUITS = PRODUITS.map((p) => p.id);
const IDS_UNIVERS = Object.values(UNIVERS);

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
test.skip(!env, "variables Supabase absentes");

// SQL exécuté par la Supabase CLI : base liée (koma-dev) en local, base locale en CI. `--local` n'accepte qu'UNE commande par appel :
// chaque écriture est donc un seul bloc `do $$ … $$` (une seule transaction). La sortie texte n'est jamais lue : les lectures passent par
// le client Supabase (clé service), identique en local et en CI.
function sql(requete: string): void {
  const dossier = mkdtempSync(join(tmpdir(), "e2e-a2-"));
  const fichier = join(dossier, "requete.sql");
  writeFileSync(fichier, requete);
  const r = spawnSync("npx", ["supabase", "db", "query", process.env.CI ? "--local" : "--linked", "-f", fichier], { encoding: "utf8", shell: true });
  rmSync(dossier, { recursive: true, force: true });
  if (r.status !== 0 || /"error"|ERROR/.test(r.stdout + r.stderr)) throw new Error(`SQL en échec : ${(r.stdout + r.stderr).slice(0, 1200)}`);
}

function sqlBloc(corps: string): void {
  sql(["do $bloc$", "begin", `perform set_config('ks.auteur', '${AUTEUR}', true);`, corps, "end", "$bloc$;"].join("\n"));
}

function service(): SupabaseClient {
  if (!env) throw new Error("variables Supabase absentes");
  return createClient(env.url, env.secrete, { auth: { persistSession: false, autoRefreshToken: false } });
}

const liste = (ids: readonly string[]) => ids.map((id) => `'${id}'`).join(", ");

// Nettoyage complet, dans l'ordre inverse de la création ; rejouable (aussi lancé avant de semer).
async function nettoyer() {
  sqlBloc(`alter table public.produit disable trigger produit_publie_complet;
delete from public.produit_photo where produit_id in (${liste(IDS_PRODUITS)});
delete from public.variante where produit_id in (${liste(IDS_PRODUITS)});
delete from public.produit where id in (${liste(IDS_PRODUITS)}) or slug like 'test-e2e-a2-%';
alter table public.produit enable trigger produit_publie_complet;
delete from public.univers where id in (${liste(IDS_UNIVERS)}) or nom_fr like 'TEST_ Univers % e2e A2';`);
  // Erreur du stockage levée : jamais un « 0 fichier » supposé.
  const { error } = await service().storage.from("produits-public").remove(PRODUITS.map((p) => p.fichier));
  if (error) throw new Error(`suppression des photos TEST_ impossible : ${error.message}`);
}

// Contrôle final : aucune donnée TEST_ de ce fichier ne reste. Comptes exacts lus par le client Supabase (clé service).
async function compterRestes(): Promise<Record<string, number>> {
  const compter = async (table: string, colonne: string, ids: readonly string[]): Promise<number> => {
    const { count, error } = await service().from(table).select("*", { count: "exact", head: true }).in(colonne, [...ids]);
    if (error || count === null) throw new Error(`comptage de ${table} impossible : ${error?.message}`);
    return count;
  };
  const slugs = await service().from("produit").select("id", { count: "exact", head: true }).like("slug", "test-e2e-a2-%");
  if (slugs.error || slugs.count === null) throw new Error(`comptage des adresses impossible : ${slugs.error?.message}`);
  const { data, error } = await service().storage.from("produits-public").list("test-e2e-a2");
  if (error || !data) throw new Error(`liste des photos TEST_ impossible : ${error?.message}`);
  return {
    produits: (await compter("produit", "id", IDS_PRODUITS)) + slugs.count,
    variantes: await compter("variante", "produit_id", IDS_PRODUITS),
    photos: await compter("produit_photo", "produit_id", IDS_PRODUITS),
    univers: await compter("univers", "id", IDS_UNIVERS),
    fichiers: data.length,
  };
}

// Deux univers TEST_ ; pour chaque famille, un produit publié par univers (photo, prix ; une variante en stock pour les produits physiques).
async function semer() {
  const photo = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3430"/><stop offset="1" stop-color="#cdbfa6"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/></svg>`,
    ),
  )
    .jpeg()
    .toBuffer();
  for (const p of PRODUITS) {
    const { error } = await service().storage.from("produits-public").upload(p.fichier, photo, { upsert: true, contentType: "image/jpeg" });
    if (error) throw new Error(`envoi de ${p.fichier} impossible : ${error.message}`);
  }
  const produits = PRODUITS.map(
    (p) => `('${p.id}', '${p.famille}', '${p.slug}', '${p.titre}', '${p.titre}', 'TEST_ description de démonstration', 'TEST_ demo description', 1500, '${p.univers}')`,
  ).join(",\n  ");
  const photos = PRODUITS.map((p) => `('${p.id}', '${p.fichier}', 1, 'TEST_ photo de démonstration', 'TEST_ demo photo')`).join(",\n  ");
  const variantes = PRODUITS.filter((p) => p.taille !== null)
    .map((p) => `('${p.id}', '${p.taille}', 3)`)
    .join(",\n  ");
  sqlBloc(`insert into public.univers (id, nom_fr, nom_en) values
  ('${UNIVERS.A}', '${NOM_UNIVERS.A}', '${NOM_UNIVERS.A}'),
  ('${UNIVERS.B}', '${NOM_UNIVERS.B}', '${NOM_UNIVERS.B}');
alter table public.produit disable trigger produit_publie_complet;
insert into public.produit (id, famille, slug, titre_fr, titre_en, description_fr, description_en, prix_cents, univers_id) values
  ${produits};
insert into public.produit_photo (produit_id, fichier, position, alt_fr, alt_en) values
  ${photos};
insert into public.variante (produit_id, taille, stock) values
  ${variantes};
update public.produit set publie_le = now() where id in (${liste(IDS_PRODUITS)});
alter table public.produit enable trigger produit_publie_complet;`);
}

const ERREUR = "Le catalogue est indisponible pour le moment";
const sansDefilement = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const carte = (page: Page, famille: Famille, lettre: Lettre) => page.locator(`main [data-carte="${produit(famille, lettre).id}"]`);

async function ouvrir(page: Page, adresse: string) {
  const reponse = await page.goto(adresse, { waitUntil: "networkidle" });
  expect(reponse?.status()).toBe(200);
  await expect(page.locator("main")).not.toContainText(ERREUR);
  expect(await sansDefilement(page)).toBe(true);
}

test.describe.configure({ mode: "serial" });

test.describe("bug A2 : filtre univers des catalogues", () => {
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
      console.log(`[e2e A2] données TEST_ restantes : ${JSON.stringify(restes)}`);
      expect(restes).toEqual({ produits: 0, variantes: 0, photos: 0, univers: 0, fichiers: 0 });
    }
  });

  for (const { famille, chemin } of FAMILLES) {
    test(`${chemin} : sans filtre, univers A, univers B, univers inconnu et invalide`, async ({ page }) => {
      test.setTimeout(120_000);
      // Sans filtre : les deux produits TEST_ (publiés à now() : en tête du tri par nouveautés, même si d'autres viennent d'être publiés).
      await ouvrir(page, chemin);
      for (const l of LETTRES) await expect(carte(page, famille, l)).toBeVisible();
      await expect(page.getByRole("heading", { level: 3, name: produit(famille, "A").titre })).toBeVisible();

      // Univers A puis B : seulement le produit TEST_ de cet univers (univers neuf : aucun autre produit n'y est rangé).
      for (const [choisi, autre] of [["A", "B"], ["B", "A"]] as const) {
        await ouvrir(page, `${chemin}?univers=${UNIVERS[choisi]}`);
        await expect(carte(page, famille, choisi)).toBeVisible();
        await expect(carte(page, famille, autre)).toHaveCount(0);
        await expect(page.locator("main [data-carte]")).toHaveCount(1);
      }

      // Univers inconnu : aucun produit, phrase courte, jamais l'erreur.
      await ouvrir(page, `${chemin}?univers=${UNIVERS_INCONNU}`);
      await expect(page.locator("main [data-carte]")).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: "Aucun produit ne correspond à ces filtres." })).toBeVisible();

      // Univers invalide : filtre ignoré, les deux produits TEST_, jamais l'erreur.
      await ouvrir(page, `${chemin}?univers=${UNIVERS_INVALIDE}`);
      for (const l of LETTRES) await expect(carte(page, famille, l)).toBeVisible();
    });
  }

  // Captures publiées par la CI (artefact « captures-e2e ») : /fr/vetements filtré sur l'univers A, 375 et 1366 px, clair et sombre.
  for (const theme of ["clair", "sombre"] as const) {
    for (const largeur of [375, 1366] as const) {
      test(`capture /fr/vetements?univers=A à ${largeur} px, thème ${theme}`, async ({ page }) => {
        if (theme === "sombre") await page.addInitScript(() => window.localStorage.setItem("ks-theme", "dark"));
        await page.setViewportSize({ width: largeur, height: 900 });
        await ouvrir(page, `/fr/vetements?univers=${UNIVERS.A}`);
        // Thème crème par défaut : aucun attribut, ou « light » ; thème sombre : « dark ».
        if (theme === "sombre") await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        else await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
        await expect(carte(page, "vetement", "A")).toBeVisible();
        await page.screenshot({ path: `test-results/captures/a2-vetements-univers-${largeur}-${theme}.png`, fullPage: true, mask: [page.locator("header")] });
      });
    }
  }
});
