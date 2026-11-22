import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

// A3-bis (2026-11-22) : sur une page traduite par le navigateur, le traducteur remplace chaque nœud texte par ses <font> ; React écrivait
// ensuite le nouveau nombre dans l'ancien nœud, qui n'est plus affiché. Les nombres qui changent portent translate="no" : le traducteur
// les saute. Parcours réel : un produit TEST_ semé, ajouté au Panier du visiteur, /fr/panier traduit (simulé dans la page, comme le fait
// le navigateur : nœuds texte remplacés par <font><font>, [translate="no"] sauté), puis la quantité passe de 1 à 2 : le total de ligne et
// le sous-total affichés sont ceux du serveur (2 × 12,00 $US). Aucun Compte, aucun paiement, aucun statut simulé (règle 13).
// Données TEST_ (produit, photo dessinée ici, Panier du visiteur) supprimées à la fin, même en cas d'échec, puis comptées (0 attendu).

const AUTEUR = `{"type":"systeme","nom":"e2e A3-bis TEST"}`;
const ID = "00000000-0000-4000-8a3b-000000000001";
const SLUG = "test-e2e-a3bis-objet";
const TITRE = "TEST_ Objet traduit";
const DOSSIER = "test-e2e-a3bis";
const FICHIER = `${DOSSIER}/objet.jpg`;

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
  const dossier = mkdtempSync(join(tmpdir(), "e2e-a3bis-"));
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

// Le Panier du visiteur (sans Compte) qui contient le produit TEST_ est supprimé avec ses lignes (suppression en cascade).
async function nettoyer() {
  sqlBloc(`delete from public.panier where compte_id is null and id in (select panier_id from public.ligne_panier where produit_id = '${ID}');
delete from public.ligne_panier where produit_id = '${ID}';
alter table public.produit disable trigger produit_publie_complet;
delete from public.produit_photo where produit_id = '${ID}';
delete from public.variante where produit_id = '${ID}';
delete from public.produit where id = '${ID}' or slug = '${SLUG}';
alter table public.produit enable trigger produit_publie_complet;`);
  await service().storage.from("produits-public").remove([FICHIER]);
}

async function compterRestes(): Promise<Record<string, number>> {
  const compter = async (table: string, colonne: string): Promise<number> => {
    const { count, error } = await service().from(table).select("*", { count: "exact", head: true }).eq(colonne, ID);
    if (error || count === null) throw new Error(`comptage de ${table} impossible : ${error?.message}`);
    return count;
  };
  const { data } = await service().storage.from("produits-public").list(DOSSIER);
  return {
    produits: await compter("produit", "id"),
    variantes: await compter("variante", "produit_id"),
    photos: await compter("produit_photo", "produit_id"),
    lignes_panier: await compter("ligne_panier", "produit_id"),
    fichiers: (data ?? []).length,
  };
}

// « Autre article » publié à 12,00 USD, Taille unique, stock 5 : s'ajoute au Panier sans choix de taille.
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

// Traduction simulée dans la page, comme Google Traduction : chaque nœud texte de <main> (hors [translate="no"] et hors <font> déjà posés)
// est remplacé par <font><font>[traduit] texte</font></font>. Renvoie le nombre de textes remplacés.
async function traduireLaPage(page: Page): Promise<number> {
  return page.evaluate(() => {
    const racine = document.querySelector("main");
    if (!racine) return 0;
    const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest('[translate="no"], font, script, style') ? NodeFilter.FILTER_REJECT : n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const textes: Text[] = [];
    while (parcours.nextNode()) textes.push(parcours.currentNode as Text);
    for (const texte of textes) {
      const exterieur = document.createElement("font");
      const interieur = document.createElement("font");
      interieur.textContent = `[traduit] ${texte.data}`;
      exterieur.appendChild(interieur);
      texte.replaceWith(exterieur);
    }
    return textes.length;
  });
}

const MONTANT = (n: string) => new RegExp(`^${n}\\s\\$US$`);

test.describe.configure({ mode: "serial" });

test.describe("A3-bis : Panier traduit par le navigateur, la quantité change, le total affiché est le bon", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    if (!env) return;
    await nettoyer();
    await semer();
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    if (!env) return;
    let erreurNettoyage: unknown = null;
    try {
      await nettoyer();
    } catch (e) {
      erreurNettoyage = e;
    }
    const restes = await compterRestes();
    console.log(`[e2e A3-bis] données TEST_ restantes : ${JSON.stringify(restes)}`);
    if (erreurNettoyage) throw erreurNettoyage;
    expect(restes).toEqual({ produits: 0, variantes: 0, photos: 0, lignes_panier: 0, fichiers: 0 });
  });

  test("quantité 1 → 2 sur /fr/panier traduit : total de ligne et sous-total = 2 × 12,00 $US", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    await page.goto(`/fr/autres-articles/${SLUG}`, { waitUntil: "networkidle" });
    await expect(async () => {
      await page.getByRole("button", { name: "Ajouter au panier" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Ajouté au panier" })).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 20_000 });

    await page.goto("/fr/panier", { waitUntil: "networkidle" });
    const ligne = page.getByRole("main").getByRole("listitem").filter({ hasText: TITRE });
    const totalLigne = ligne.locator("p", { hasText: "Total de la ligne" }).locator('[translate="no"]');
    const sousTotal = page.locator('section[aria-labelledby="panier-recap"] [translate="no"]');
    await expect(totalLigne).toHaveText(MONTANT("12,00"));
    await expect(sousTotal).toHaveText(MONTANT("12,00"));

    expect(await traduireLaPage(page)).toBeGreaterThan(0);
    // Le libellé est traduit, le montant reste dans son [translate="no"].
    await expect(ligne.locator("p", { hasText: "Total de la ligne" }).locator("font font")).toHaveText("[traduit] Total de la ligne : ");
    await expect(totalLigne).toHaveText(MONTANT("12,00"));
    // Seuls des nombres sont exclus de la traduction : aucun libellé, bouton ou titre n'a d'ancêtre translate="no".
    const nonTraduits = await page.getByRole("main").locator('[translate="no"]').allTextContents();
    expect(nonTraduits.length).toBeGreaterThan(0);
    for (const t of nonTraduits) expect(t.trim()).toMatch(/^(\d+|[\d\s.,]+\s\$US)$/);

    // Champ et bouton visés par leur structure : leurs libellés sont maintenant « traduits ».
    await ligne.locator('input[name="nombre"]').fill("2");
    await ligne.locator('button[type="submit"]').first().click();

    await expect(totalLigne).toHaveText(MONTANT("24,00"), { timeout: 20_000 });
    await expect(sousTotal).toHaveText(MONTANT("24,00"));
    // Ce que voit le visiteur (texte rendu de la ligne et du récapitulatif) : le nouveau total, jamais l'ancien.
    const vu = (await ligne.locator("p", { hasText: "Total de la ligne" }).innerText()).replace(/\s+/g, " ");
    expect(vu).toMatch(/24,00 \$US$/);
    const recap = (await page.locator('section[aria-labelledby="panier-recap"]').innerText()).replace(/\s+/g, " ");
    expect(recap).toContain("24,00 $US");
    expect(recap).not.toContain("12,00 $US");
    await page.screenshot({ path: "test-results/captures/a3bis-panier-traduit-quantite-2.png", fullPage: true, mask: [page.locator("header")] });
  });
});
