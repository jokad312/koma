import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import sharp from "sharp";

// Outils communs des e2e de la story 9.16 a) (police KOMA Chikara). Données TEST_ sur la base de .env.local (koma-dev en local,
// base locale en CI) : produit TEST_ publié et Compte TEST_, créés puis TOUS supprimés et comptés. Aucun paiement simulé (règle 13).

export function lireEnv() {
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
export type Env = NonNullable<ReturnType<typeof lireEnv>>;

const AUTEUR = `{"type":"systeme","nom":"e2e 9.16 TEST"}`;

// `--local` n'accepte qu'UNE commande par appel : un seul bloc do $$ … $$ (une transaction, auteur journalisé).
export function sqlBloc(corps: string): void {
  const dossier = mkdtempSync(join(tmpdir(), "e2e-916-"));
  const fichier = join(dossier, "requete.sql");
  writeFileSync(fichier, ["do $bloc$", "begin", `perform set_config('ks.auteur', '${AUTEUR}', true);`, corps, "end", "$bloc$;"].join("\n"));
  const r = spawnSync("npx", ["supabase", "db", "query", process.env.CI ? "--local" : "--linked", "-f", fichier], { encoding: "utf8", shell: true });
  rmSync(dossier, { recursive: true, force: true });
  if (r.status !== 0 || /"error"|ERROR/.test(r.stdout + r.stderr)) throw new Error(`SQL en échec : ${(r.stdout + r.stderr).slice(0, 1200)}`);
}

export function service(env: Env): SupabaseClient {
  return createClient(env.url, env.secrete, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Produit TEST_ publié (famille Vêtement, une variante en stock) avec une photo dessinée ici (aucune image tierce).
export type ProduitTest = { id: string; slug: string; titre: string; titreEn: string; fichier: string };

export async function semerProduit(env: Env, p: ProduitTest): Promise<void> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#3a3430"/></svg>`;
  const envoi = await service(env)
    .storage.from("produits-public")
    .upload(p.fichier, await sharp(Buffer.from(svg)).jpeg().toBuffer(), { upsert: true, contentType: "image/jpeg" });
  if (envoi.error) throw new Error(`envoi de la photo impossible : ${envoi.error.message}`);
  sqlBloc(`alter table public.produit disable trigger produit_publie_complet;
insert into public.produit (id, famille, slug, titre_fr, titre_en, description_fr, description_en, prix_cents) values
  ('${p.id}', 'vetement', '${p.slug}', '${p.titre}', '${p.titreEn}', 'TEST_ description de démonstration', 'TEST_ demo description', 2500);
insert into public.produit_photo (produit_id, fichier, position, alt_fr, alt_en) values
  ('${p.id}', '${p.fichier}', 1, 'TEST_ photo de démonstration', 'TEST_ demo photo');
insert into public.variante (produit_id, taille, couleur_fr, couleur_en, couleur_hex, stock) values ('${p.id}', 'M', 'Noir', 'Black', '#1B1713', 5);
update public.produit set publie_le = now() - interval '1 hour' where id = '${p.id}';
alter table public.produit enable trigger produit_publie_complet;`);
}

export async function retirerProduit(env: Env, p: ProduitTest): Promise<void> {
  sqlBloc(`delete from public.ligne_panier where produit_id = '${p.id}';
alter table public.produit disable trigger produit_publie_complet;
delete from public.produit_photo where produit_id = '${p.id}';
delete from public.variante where produit_id = '${p.id}';
delete from public.produit where id = '${p.id}' or slug = '${p.slug}';
alter table public.produit enable trigger produit_publie_complet;`);
  await service(env).storage.from("produits-public").remove([p.fichier]);
}

export async function restesProduit(env: Env, p: ProduitTest): Promise<Record<string, number>> {
  const compter = async (table: string, colonne: string) => {
    const { count, error } = await service(env).from(table).select("*", { count: "exact", head: true }).eq(colonne, p.id);
    if (error || count === null) throw new Error(`comptage de ${table} impossible : ${error?.message}`);
    return count;
  };
  const dossier = p.fichier.split("/")[0];
  const { data } = await service(env).storage.from("produits-public").list(dossier);
  return { produits: await compter("produit", "id"), variantes: await compter("variante", "produit_id"), photos: await compter("produit_photo", "produit_id"), fichiers: (data ?? []).length };
}

// Compte TEST_ réel (API d'administration), rôle admin facultatif, session posée dans le navigateur. Renvoie la suppression du Compte.
export async function connecterCompteTest(page: Page, env: Env, prefixe: string, role?: "admin"): Promise<() => Promise<void>> {
  const admin = service(env);
  const email = `${prefixe}${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.invalid`;
  const cree = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: "TEST Police" } });
  if (cree.error || !cree.data.user) throw new Error(`création du Compte TEST_ impossible : ${cree.error?.message}`);
  const id = cree.data.user.id;
  const supprimer = async () => {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`suppression du Compte TEST_ impossible : ${error.message}`);
  };
  try {
    const appels: [string, Record<string, unknown>][] = [
      ["declarer_age", { p_auteur: { type: "systeme", nom: "e2e 9.16 TEST" }, p_compte: id, p_age: 25 }],
      ["enregistrer_questions_accueil", { p_auteur: { type: "compte", id, role: null }, p_compte: id, p_origine: null, p_preference: null }],
    ];
    if (role) appels.push(["attribuer_role", { p_auteur: { type: "systeme", nom: "e2e 9.16 TEST" }, p_compte: id, p_role: role }]);
    for (const [fn, args] of appels) {
      const r = await admin.rpc(fn, args);
      if (r.error) throw new Error(`${fn} : ${r.error.message}`);
    }
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

export async function violationsGraves(page: Page): Promise<string[]> {
  // Mot géant du héros : filigrane purement décoratif (aria-hidden), exempté comme dans accessibilite.spec.ts.
  const r = await new AxeBuilder({ page }).exclude(".mot-geant").exclude(".hv-geant").analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

// Pile de polices calculée du <body> et éléments de texte visibles sous 16 px (getComputedStyle), décrits pour le message d'échec.
export async function etatTypo(page: Page) {
  return page.evaluate(() => {
    const petits: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const aTexte = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
      if (!aTexte || el.closest("svg, script, style, noscript, template")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || el.getClientRects().length === 0) continue;
      const taille = parseFloat(style.fontSize);
      if (taille < 16) petits.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} « ${(el.textContent ?? "").trim().slice(0, 30)} » ${taille}px`);
    }
    return { famille: getComputedStyle(document.body).fontFamily, petits };
  });
}
