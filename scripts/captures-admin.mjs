// Story 9.16 b) : captures du cadre A de l'admin comparées aux maquettes, et contrôles de mise en page.
// Usage : contre un build de production lancé par `npm start -- -p 3200` (adresse modifiable par CAPTURES_URL) : `node scripts/captures-admin.mjs`.
// Sortie : docs/captures-admin/9-16-b/ (ignoré par Git, jamais commité) et index.html pour la revue. Pages de l'étape 4 (9.16 c et suivantes) :
// CAPTURES_SORTIE (dossier, par exemple docs/captures-admin/9-16-c) et CAPTURES_VUES (clés séparées par des virgules, par exemple « tableau »).
// Maquettes lues dans docs/references/maquettes-admin/ (ignoré par Git).
// Deux Comptes TEST_ réels sur la base de .env.local (koma-dev) : un Admin et un Assistant, créés au début et TOUS supprimés à la fin, même en cas d'échec,
// puis comptés (0 attendu). Aucune donnée de boutique n'est créée ; aucun paiement, aucune notification ni aucun statut simulé (règle 13).
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const RACINE = process.env.CAPTURES_SORTIE ?? "docs/captures-admin/9-16-b";
const MAQUETTES = "docs/references/maquettes-admin";
const BASE = (process.env.CAPTURES_URL ?? "http://localhost:3200").replace(/\/+$/, "");
const EMAIL_PREFIXE = "test-captures-916b-";
const AUTEUR = { type: "systeme", nom: "captures 9.16 b TEST" };

// Les 7 vues des maquettes : [clé, libellé, chemin, maquette].
const TOUTES_LES_VUES = [
  ["tableau", "Tableau de bord", "/fr/admin", "Admin · Tableau de bord.png"],
  ["commandes", "Commandes", "/fr/admin/commandes", "02-commandes.png"],
  ["produits", "Produits", "/fr/admin/produits", "03-produits.png"],
  ["nouveau-produit", "Nouveau produit", "/fr/admin/produits/nouveau", "04-nouveau-produit.png"],
  ["blog", "Blog", "/fr/admin/blog", "05-blog.png"],
  ["nouvel-article", "Nouvel article", "/fr/admin/blog/nouveau", "06-nouvel-article.png"],
  ["codes-promo", "Codes promo", "/fr/admin/codes-promo", "07-codes-promo.png"],
  // Story 9.16 f : la fenêtre du formulaire pour un Vêtement et un Kit, en création (saisie à l'écran, rien n'est enregistré) et en modification
  // (produits TEST_ semés ci-dessous). Le 5e élément est l'action faite après l'ouverture de la page.
  ["nouveau-vetement", "Nouveau produit : Vêtement", "/fr/admin/produits/nouveau", "04-nouveau-produit.png", (p) => remplirCreation(p, /^Vêtement/, "TEST_ Polo")],
  ["nouveau-kit", "Nouveau produit : Kit", "/fr/admin/produits/nouveau", "04-nouveau-produit.png", (p) => remplirCreation(p, /^Kit/, "TEST_ Kit patron")],
  ["modifier-vetement", "Modifier un Vêtement TEST_", "/fr/admin/produits/00000000-0000-4000-8916-00000000ca03", "04-nouveau-produit.png"],
  ["modifier-kit", "Modifier un Kit TEST_", "/fr/admin/produits/00000000-0000-4000-8916-00000000ca02", "04-nouveau-produit.png"],
  // Story 9.16 h : la fenêtre de l'article en création (saisie à l'écran, rien n'est enregistré) et en modification (article TEST_ semé ci-dessous,
  // avec image et extrait).
  ["nouvel-article-saisi", "Nouvel article : saisie", "/fr/admin/blog/nouveau", "06-nouvel-article.png", (p) => remplirArticle(p)],
  ["modifier-article", "Modifier un article TEST_", "/fr/admin/blog/00000000-0000-4000-8916-00000000ab01", "06-nouvel-article.png"],
  // Story 9.16 i : fenêtres de création et de modification d'un Code promo (codes TEST_ semés ci-dessous). Rien n'est envoyé.
  // Étape 8 (story 9.16, pages sans maquette) : maquette null, ni côte à côte ni superposition ; mêmes captures sinon.
  ["taches", "Tâches", "/fr/admin/taches", null],
  ["univers", "Univers", "/fr/admin/univers", null],
  ["utilisateurs", "Utilisateurs", "/fr/admin/utilisateurs", null],
  ["evenements", "Événements", "/fr/admin/evenements", null],
  ["nouvel-evenement", "Nouvel événement", "/fr/admin/evenements/nouveau", null],
  ["galerie", "Galerie", "/fr/admin/galerie", null],
  ["messages", "Messages", "/fr/admin/messages", null],
  ["prestataires", "Prestataires", "/fr/admin/prestataires", null],
  ["reglages", "Réglages", "/fr/admin/reglages", null],
  // Point 2 de Jonathan (2026-11-21) : fiche d'un événement TEST_ complet et détail d'une commande TEST_ payée de deux articles (semés ci-dessous).
  ["fiche-evenement", "Fiche d'un événement TEST_", "/fr/admin/evenements/00000000-0000-4000-8916-00000000ee01", null],
  ["detail-commande", "Détail d'une commande TEST_ payée", "/fr/admin/commandes/KS-2026-916001", null],
  ["nouveau-code", "Nouveau code promo", "/fr/admin/codes-promo?nouveau=1", "07-codes-promo.png"],
  ["modifier-code", "Modifier un code promo TEST_", "/fr/admin/codes-promo?modifier=00000000-0000-4000-8916-00000000cc01", "07-codes-promo.png"],
];

// Création d'un article : titre, extrait et contenu. Rien n'est envoyé.
async function remplirArticle(page) {
  await page.getByLabel("Titre en français").fill("TEST_ Guide de l'armure en mousse");
  await page.getByLabel("Extrait (résumé court) en français").fill("TEST_ Découpe, chauffe et assemble une armure légère en mousse EVA.");
  await page.getByLabel("Texte en français").fill("## Matériel\n\n**TEST_** mousse EVA, colle contact, pistolet à chaleur.");
  await page.waitForTimeout(200);
  await page.locator("[data-defilement-fenetre]").evaluate((e) => e.scrollTo(0, 0));
}

// Création d'un produit : nom, description, prix, puis la famille (placée après les champs de la maquette). Rien n'est envoyé.
async function remplirCreation(page, famille, titre) {
  await page.getByLabel("Titre en français").fill(titre);
  await page.getByLabel("Description en français").fill("TEST_ description de démonstration");
  await page.getByLabel("Prix en dollars US (USD)").fill("25");
  await page.getByRole("radio", { name: famille }).check({ force: true });
  await page.waitForTimeout(200);
  await page.locator("[data-defilement-fenetre]").evaluate((e) => e.scrollTo(0, 0));
}
const FILTRE = process.env.CAPTURES_VUES?.split(",").map((v) => v.trim()).filter(Boolean);
const VUES = FILTRE?.length ? TOUTES_LES_VUES.filter(([cle]) => FILTRE.includes(cle)) : TOUTES_LES_VUES;

function lireEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Variables déjà définies.
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publique = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secrete = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publique || !secrete) throw new Error("variables Supabase absentes (.env.local)");
  return { url, publique, secrete };
}
const env = lireEnv();
const service = createClient(env.url, env.secrete, { auth: { persistSession: false, autoRefreshToken: false } });

async function comptesTest() {
  const { data, error } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`liste des Comptes : ${error.message}`);
  return data.users.filter((u) => (u.email ?? "").startsWith(EMAIL_PREFIXE)).map((u) => u.id);
}

async function nettoyer() {
  for (const id of await comptesTest()) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) throw new Error(`suppression du Compte TEST_ impossible : ${error.message}`);
  }
}

// Story 9.16 e) : vue « produits » remplie de 4 produits TEST_ (cosplay publié avec photo dessinée ici, Kit gratuit, Vêtement sans prix, Autre
// article archivé), créés par la Supabase CLI sur la base liée (auteur « systeme » journalisé) et TOUS supprimés à la fin, puis comptés (0 attendu).
const PRODUITS_TEST = {
  cosplay: "00000000-0000-4000-8916-00000000ca01",
  kit: "00000000-0000-4000-8916-00000000ca02",
  vetement: "00000000-0000-4000-8916-00000000ca03",
  autre: "00000000-0000-4000-8916-00000000ca04",
};
const PHOTO_TEST = "test-captures-916e/cosplay.jpg";
const avecProduits = () => VUES.some(([cle]) => cle === "produits" || cle.startsWith("modifier-") || cle === "detail-commande");

function sqlBloc(corps) {
  const dossier = mkdtempSync(join(tmpdir(), "captures-916e-"));
  const fichier = join(dossier, "requete.sql");
  writeFileSync(fichier, ["do $bloc$", "begin", `perform set_config('ks.auteur', '${JSON.stringify(AUTEUR)}', true);`, corps, "end", "$bloc$;"].join("\n"));
  const r = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", fichier], { encoding: "utf8", shell: true });
  rmSync(dossier, { recursive: true, force: true });
  if (r.status !== 0 || /"error"|ERROR/.test(r.stdout + r.stderr)) throw new Error(`SQL en échec : ${(r.stdout + r.stderr).slice(0, 800)}`);
}

const listeProduitsTest = () => Object.values(PRODUITS_TEST).map((id) => `'${id}'`).join(",");

async function retirerProduitsTest() {
  sqlBloc(`alter table public.produit disable trigger produit_publie_complet;
delete from public.produit_photo where produit_id in (${listeProduitsTest()});
delete from public.variante where produit_id in (${listeProduitsTest()});
delete from public.produit where id in (${listeProduitsTest()});
alter table public.produit enable trigger produit_publie_complet;`);
  await service.storage.from("produits-public").remove([PHOTO_TEST]);
}

async function semerProduitsTest() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#5a4a40"/><circle cx="200" cy="170" r="80" fill="#8c514e"/></svg>`;
  const envoi = await service.storage.from("produits-public").upload(PHOTO_TEST, await sharp(Buffer.from(svg)).jpeg().toBuffer(), { upsert: true, contentType: "image/jpeg" });
  if (envoi.error) throw new Error(`photo TEST_ : ${envoi.error.message}`);
  const p = PRODUITS_TEST;
  sqlBloc(`alter table public.produit disable trigger produit_publie_complet;
insert into public.produit (id, famille, slug, titre_fr, titre_en, description_fr, description_en, prix_cents, niveau) values
  ('${p.cosplay}', 'cosplay', 'test-captures-916e-cosplay', 'TEST_ Cosplay démonstration', 'TEST_ Demo cosplay', 'TEST_ d', 'TEST_ d', 4500, null),
  ('${p.kit}', 'kit', 'test-captures-916e-kit', 'TEST_ Kit démonstration', 'TEST_ Demo kit', 'TEST_ d', 'TEST_ d', 0, 'debutant'),
  ('${p.vetement}', 'vetement', 'test-captures-916e-polo', 'TEST_ Polo démonstration', 'TEST_ Demo polo', null, null, null, null),
  ('${p.autre}', 'autre', 'test-captures-916e-autre', 'TEST_ Objet archivé', 'TEST_ Archived item', null, null, 1000, null);
insert into public.produit_photo (produit_id, fichier, position, alt_fr, alt_en) values ('${p.cosplay}', '${PHOTO_TEST}', 1, 'TEST_ photo de démonstration', 'TEST_ demo photo');
insert into public.variante (produit_id, taille, stock) values ('${p.cosplay}', 'M', 2), ('${p.autre}', 'unique', 1);
update public.produit set publie_le = now() - interval '1 hour' where id = '${p.cosplay}';
update public.produit set archive_le = now() where id = '${p.autre}';
alter table public.produit enable trigger produit_publie_complet;`);
}

async function compterProduitsTest() {
  const { count, error } = await service.from("produit").select("id", { count: "exact", head: true }).in("id", Object.values(PRODUITS_TEST));
  if (error || count === null) throw new Error(`comptage des produits TEST_ : ${error?.message}`);
  const { data } = await service.storage.from("produits-public").list("test-captures-916e");
  return count + (data ?? []).length;
}

// Story 9.16 g) : vue « blog » remplie de 4 articles TEST_ (publié avec image dessinée ici, publié sans image, brouillon, archivé), TOUS supprimés
// à la fin, puis comptés (0 attendu).
const ARTICLES_TEST = ["00000000-0000-4000-8916-00000000ab01", "00000000-0000-4000-8916-00000000ab02", "00000000-0000-4000-8916-00000000ab03", "00000000-0000-4000-8916-00000000ab04"];
const IMAGE_ARTICLE_TEST = "test-captures-916g/article.jpg";
const avecArticles = () => VUES.some(([cle]) => cle === "blog" || cle === "modifier-article");
const listeArticlesTest = () => ARTICLES_TEST.map((id) => `'${id}'`).join(",");

async function retirerArticlesTest() {
  sqlBloc(`delete from public.article where id in (${listeArticlesTest()});`);
  await service.storage.from("produits-public").remove([IMAGE_ARTICLE_TEST]);
}

async function semerArticlesTest() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#4a3f38"/><circle cx="400" cy="200" r="120" fill="#8c514e"/></svg>`;
  const envoi = await service.storage.from("produits-public").upload(IMAGE_ARTICLE_TEST, await sharp(Buffer.from(svg)).jpeg().toBuffer(), { upsert: true, contentType: "image/jpeg" });
  if (envoi.error) throw new Error(`image TEST_ : ${envoi.error.message}`);
  const [a, b, c, d] = ARTICLES_TEST;
  const texte = `'## Fabriquer une armure en mousse' || chr(10) || chr(10) || '**TEST** : texte de démonstration. ' || repeat('Découpe, chauffe, colle et peins chaque pièce. ', 6)`;
  sqlBloc(`insert into public.article (id, auteur_id, titre_fr, texte_fr, slug, images, publie_le, archive_le) values
  ('${a}', '${a}', 'TEST_ Guide de l''armure en mousse', ${texte}, 'test-captures-916g-a', '[{"fichier":"${IMAGE_ARTICLE_TEST}","alt_fr":"TEST_ image de démonstration","alt_en":"TEST_ demo image"}]'::jsonb, now() - interval '3 days', null),
  ('${b}', '${a}', 'TEST_ Annonce du prochain atelier', ${texte}, 'test-captures-916g-b', '[]'::jsonb, now() - interval '1 day', null),
  ('${c}', '${a}', 'TEST_ Brouillon de perruque', null, 'test-captures-916g-c', '[]'::jsonb, null, null),
  ('${d}', '${a}', 'TEST_ Article archivé', ${texte}, 'test-captures-916g-d', '[]'::jsonb, null, now());
-- Story 9.16 h : extrait saisi sur le premier article (carte de la liste et fenêtre de modification).
update public.article set extrait_fr = 'TEST_ Découpe, chauffe et assemble une armure légère en mousse EVA.' where id = '${a}';`);
}

async function compterArticlesTest() {
  const { count, error } = await service.from("article").select("id", { count: "exact", head: true }).in("id", ARTICLES_TEST);
  if (error || count === null) throw new Error(`comptage des articles TEST_ : ${error?.message}`);
  const { data } = await service.storage.from("produits-public").list("test-captures-916g");
  return count + (data ?? []).length;
}

// Point 2 (2026-11-21) : événement TEST_ complet (dates, lieu, capacité, deux Types de pass dont un Stand, publié) et Commande TEST_ payée de deux
// articles (cosplay M et autre article des produits TEST_), au nom d'un Compte client TEST_ (le même sert d'auteur à l'événement : auteur_id n'a pas
// de clé étrangère). Données de test pour les captures seulement, à la demande de Jonathan (jamais un vrai paiement : aucune tentative, aucun
// prestataire appelé ; exception à la règle 13 notée dans DECISIONS-NUIT.md). Commande, lignes, événement et types de pass sont supprimés à la fin
// puis comptés (0) ; le journal d'audit garde, comme pour les autres données TEST_ des captures, la trace de leur création et de leur suppression.
const EVENEMENT_TEST = "00000000-0000-4000-8916-00000000ee01";
const COMMANDE_TEST = { id: "00000000-0000-4000-8916-00000000cd01", numero: "KS-2026-916001" };
const avecEvenement = () => VUES.some(([cle]) => cle === "fiche-evenement");
const avecCommande = () => VUES.some(([cle]) => cle === "detail-commande");

function retirerEvenementTest() {
  sqlBloc(`delete from public.type_pass where evenement_id = '${EVENEMENT_TEST}';
delete from public.evenement where id = '${EVENEMENT_TEST}';`);
}

function semerEvenementTest(auteurId) {
  sqlBloc(`insert into public.evenement (id, auteur_id, titre_fr, titre_en, slug, description_fr, description_en, lieu_type, lieu_fr, lieu_en, debut_le, fin_le, capacite, vente_ouvre_le, vente_ferme_le, publie_le)
  values ('${EVENEMENT_TEST}', '${auteurId}', 'TEST_ Festival cosplay de Goma', 'TEST_ Goma cosplay festival', 'test-captures-916-festival',
          'TEST_ Concours, défilé et ateliers de fabrication.', 'TEST_ Contest, parade and crafting workshops.', 'salle', 'TEST_ Salle des fêtes, Goma', 'TEST_ Hall, Goma',
          now() + interval '30 days', now() + interval '30 days 8 hours', 300, now() - interval '1 day', now() + interval '29 days', now() - interval '1 hour');
insert into public.type_pass (evenement_id, nom_fr, nom_en, prix_cents, quota, est_stand) values
  ('${EVENEMENT_TEST}', 'TEST_ Entrée', 'TEST_ Entry', 500, 250, false),
  ('${EVENEMENT_TEST}', 'TEST_ Stand', 'TEST_ Stand', 4000, 10, true);`);
}

async function compterEvenementTest() {
  const { count, error } = await service.from("evenement").select("id", { count: "exact", head: true }).eq("id", EVENEMENT_TEST);
  if (error || count === null) throw new Error(`comptage de l'événement TEST_ : ${error?.message}`);
  return count;
}

async function compteClientTest() {
  const cree = await service.auth.admin.createUser({ email: `${EMAIL_PREFIXE}client-${Date.now()}@example.invalid`, email_confirm: true, user_metadata: { full_name: "TEST Client" } });
  if (cree.error || !cree.data.user) throw new Error(`création du Compte client TEST_ impossible : ${cree.error?.message}`);
  return cree.data.user.id;
}

function retirerCommandeTest() {
  sqlBloc(`delete from public.ligne_commande where commande_id = '${COMMANDE_TEST.id}';
delete from public.commande where id = '${COMMANDE_TEST.id}' or numero = '${COMMANDE_TEST.numero}';`);
}

function semerCommandeTest(compteId) {
  const p = PRODUITS_TEST;
  sqlBloc(`insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, zone, mode_remise, telephone, prestataire, reference_transaction, paye_le)
  values ('${COMMANDE_TEST.id}', '${COMMANDE_TEST.numero}', '${compteId}', 'produits', 'payee', 5500, 5700, 200, 'goma', 'livraison', '+243990000000', 'pawapay', 'TEST_captures_916', now() - interval '2 hours');
insert into public.ligne_commande (commande_id, produit_id, variante_id, origine, nombre, prix_cents)
  select '${COMMANDE_TEST.id}', '${p.cosplay}', v.id, 'stock', 1, 4500 from public.variante v where v.produit_id = '${p.cosplay}' and v.taille = 'M';
insert into public.ligne_commande (commande_id, produit_id, variante_id, origine, nombre, prix_cents)
  select '${COMMANDE_TEST.id}', '${p.autre}', v.id, 'stock', 1, 1000 from public.variante v where v.produit_id = '${p.autre}';
-- Deux lignes exactement (une variante manquante n'insère rien, sans erreur) : sinon la capture montrerait une commande fausse.
if (select count(*) from public.ligne_commande where commande_id = '${COMMANDE_TEST.id}') <> 2 then
  raise exception 'Commande TEST_ : 2 lignes attendues';
end if;`);
}

async function compterCommandeTest() {
  const { count, error } = await service.from("commande").select("id", { count: "exact", head: true }).eq("id", COMMANDE_TEST.id);
  if (error || count === null) throw new Error(`comptage de la commande TEST_ : ${error?.message}`);
  return count;
}

// Story 9.16 i) : vue « codes-promo » remplie de 3 Codes promo TEST_ (deux actifs, un inactif), TOUS supprimés à la fin, puis comptés (0 attendu).
const CODES_TEST = ["00000000-0000-4000-8916-00000000cc01", "00000000-0000-4000-8916-00000000cc02", "00000000-0000-4000-8916-00000000cc03"];
const avecCodes = () => VUES.some(([cle]) => cle.endsWith("code") || cle === "codes-promo");
const listeCodesTest = () => CODES_TEST.map((id) => `'${id}'`).join(",");

function retirerCodesTest() {
  sqlBloc(`delete from public.code_promo where id in (${listeCodesTest()}) or code like 'TEST\\_%';`);
}

function semerCodesTest() {
  const [a, b, c] = CODES_TEST;
  sqlBloc(`insert into public.code_promo (id, code, affilie, reduction_pct, commission_pct, plafond, actif, cree_le) values
  ('${a}', 'TEST_GUN10', 'TEST_ Gun', 10, 5, 50, true, now() - interval '20 days'),
  ('${b}', 'TEST_AKI15', 'TEST_ Aki cosplay', 15, 7.5, 100, true, now() - interval '4 days'),
  ('${c}', 'TEST_ANCIEN', 'TEST_ Ancien partenaire', 5, 0, 20, false, now() - interval '60 days');`);
}

async function compterCodesTest() {
  const { count, error } = await service.from("code_promo").select("id", { count: "exact", head: true }).or(`id.in.(${CODES_TEST.join(",")}),code.like.TEST\\_%`);
  if (error || count === null) throw new Error(`comptage des codes TEST_ : ${error?.message}`);
  return count;
}

// Compte TEST_ réel avec le rôle demandé ; renvoie les cookies de session à poser dans le navigateur.
async function sessionTest(role) {
  const email = `${EMAIL_PREFIXE}${role}-${Date.now()}@example.invalid`;
  const cree = await service.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: `TEST ${role === "admin" ? "Admin" : "Assistant"}` } });
  if (cree.error || !cree.data.user) throw new Error(`création du Compte TEST_ impossible : ${cree.error?.message}`);
  const id = cree.data.user.id;
  for (const [fn, args] of [
    ["declarer_age", { p_auteur: AUTEUR, p_compte: id, p_age: 25 }],
    ["enregistrer_questions_accueil", { p_auteur: { type: "compte", id, role: null }, p_compte: id, p_origine: null, p_preference: null }],
    ["attribuer_role", { p_auteur: AUTEUR, p_compte: id, p_role: role }],
  ]) {
    const r = await service.rpc(fn, args);
    if (r.error) throw new Error(`${fn} : ${r.error.message}`);
  }
  const lien = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (lien.error) throw new Error(`lien : ${lien.error.message}`);
  const jar = new Map();
  const ssr = createServerClient(env.url, env.publique, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const v = await ssr.auth.verifyOtp({ type: "magiclink", token_hash: lien.data.properties.hashed_token });
  if (v.error) throw new Error(`session : ${v.error.message}`);
  const domaine = new URL(BASE).hostname;
  return [...jar].map(([name, value]) => ({ name, value, domain: domaine, path: "/", sameSite: "Lax" }));
}

async function contexte(navigateur, cookies, { largeur, hauteur, theme }) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, reducedMotion: "reduce" });
  await ctx.addCookies(cookies);
  await ctx.addInitScript((t) => {
    try {
      window.localStorage.setItem("ks-theme", t);
    } catch {}
  }, theme);
  return ctx;
}

async function ouvrir(page, chemin) {
  const reponse = await page.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded" });
  const arrivee = new URL(page.url()).pathname;
  if (arrivee.replace(/\/$/, "") !== chemin.split("?")[0]) throw new Error(`${chemin} a mené à ${arrivee} (HTTP ${reponse?.status()})`);
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

// Côte à côte (maquette | rendu) et superposition à 50 %.
async function comparer(cle, maquette, capture) {
  const m = await sharp(join(MAQUETTES, maquette)).resize(1366, 768).png().toBuffer();
  const c = await sharp(capture).resize(1366, 768).png().toBuffer();
  await sharp({ create: { width: 1366 * 2 + 16, height: 768, channels: 3, background: "#808080" } })
    .composite([
      { input: m, left: 0, top: 0 },
      { input: c, left: 1366 + 16, top: 0 },
    ])
    .jpeg({ quality: 80 })
    .toFile(join(RACINE, `${cle}-cote-a-cote.jpg`));
  const demi = await sharp(c).ensureAlpha(0.5).png().toBuffer();
  await sharp(m).composite([{ input: demi, left: 0, top: 0 }]).jpeg({ quality: 85 }).toFile(join(RACINE, `${cle}-superpose.jpg`));
}

// Mesures du cadre sur la page courante.
function mesures(page) {
  return page.evaluate(() => {
    const nav = document.querySelector("nav[data-barre-admin]");
    const surtitre = [...document.querySelectorAll("header p")].find((p) => /espace administrateur/i.test(p.textContent ?? ""));
    const lignes = surtitre ? Math.round(surtitre.getBoundingClientRect().height / parseFloat(getComputedStyle(surtitre).lineHeight)) : null;
    // Entrée sur plusieurs lignes : le texte occupe plus d'une ligne (rectangles de texte sur des hauteurs différentes).
    const coupes = [...(nav?.querySelectorAll("a") ?? [])]
      .filter((a) => a.getBoundingClientRect().width > 0)
      .filter((a) => {
        const r = document.createRange();
        r.selectNodeContents(a);
        return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1;
      })
      .map((a) => a.textContent);
    const actif = nav?.querySelector('[aria-current="page"]');
    return {
      debordementHorizontal: document.documentElement.scrollWidth > window.innerWidth,
      largeurDocument: document.documentElement.scrollWidth,
      menuDefile: nav ? nav.scrollHeight > nav.clientHeight + 1 : null,
      menuHauteurs: nav ? `${nav.scrollHeight}/${nav.clientHeight}` : null,
      surtitreLignes: lignes,
      surtitreDeborde: surtitre ? surtitre.scrollWidth > surtitre.clientWidth : null,
      entreesSurPlusieursLignes: coupes,
      entreeActive: actif?.textContent ?? null,
      entreeActiveFond: actif ? getComputedStyle(actif).backgroundColor : null,
      menuFond: nav ? getComputedStyle(nav).backgroundColor : null,
      entrees: [...(nav?.querySelectorAll("a") ?? [])].map((a) => a.textContent),
    };
  });
}

async function principal() {
  mkdirSync(RACINE, { recursive: true });
  const navigateur = await chromium.launch();
  const rapport = { vues: {}, largeurs: {}, assistant: null, admin: null };
  try {
    // Restes d'un passage interrompu : commande et événement d'abord (la commande référence un Compte et des produits TEST_).
    if (avecCommande()) retirerCommandeTest();
    if (avecEvenement()) retirerEvenementTest();
    await nettoyer();
    if (avecProduits()) {
      await retirerProduitsTest();
      await semerProduitsTest();
    }
    if (avecArticles()) {
      await retirerArticlesTest();
      await semerArticlesTest();
    }
    if (avecCodes()) {
      retirerCodesTest();
      semerCodesTest();
    }
    const client = avecCommande() || avecEvenement() ? await compteClientTest() : null;
    if (avecCommande()) semerCommandeTest(client);
    if (avecEvenement()) semerEvenementTest(client);
    const admin = await sessionTest("admin");
    const assistant = await sessionTest("assistant");

    // 1. Les 7 vues à 1366 × 768 en sombre, comparées aux maquettes.
    const ctx = await contexte(navigateur, admin, { largeur: 1366, hauteur: 768, theme: "dark" });
    const page = await ctx.newPage();
    for (const [cle, , chemin, maquette, action] of VUES) {
      await ouvrir(page, chemin);
      await action?.(page);
      const fichier = join(RACINE, `${cle}-sombre-1366.png`);
      await page.screenshot({ path: fichier });
      await page.screenshot({ path: join(RACINE, `${cle}-sombre-1366-entiere.png`), fullPage: true });
      if (maquette) await comparer(cle, maquette, fichier);
      // Fenêtre de formulaire (9.16 f) : le contenu défile à l'intérieur ; suite de la fenêtre, écran par écran (4 au plus).
      const defile = page.locator("[data-defilement-fenetre]");
      if (await defile.count()) {
        for (let n = 1; n <= 4; n++) {
          const avance = await defile.evaluate((e, i) => {
            const avant = e.scrollTop;
            e.scrollTo(0, e.clientHeight * i);
            return e.scrollTop > avant;
          }, n);
          if (!avance) break;
          await page.waitForTimeout(150);
          await page.screenshot({ path: join(RACINE, `${cle}-sombre-1366-suite-${n}.png`) });
        }
        await defile.evaluate((e) => e.scrollTo(0, 0));
      }
      rapport.vues[cle] = await mesures(page);
      process.stdout.write(".");
    }
    rapport.admin = rapport.vues.tableau?.entrees ?? null;

    // 2. Menu du profil ouvert, puis la fenêtre « Aide ».
    await ouvrir(page, "/fr/admin");
    await page.getByRole("button", { name: /menu du profil/ }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(RACINE, "menu-profil-sombre-1366.png") });
    await page.getByRole("button", { name: "Aide" }).click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(RACINE, "aide-sombre-1366.png") });
    await ctx.close();

    // 3. Chaque vue choisie en clair (1366) et à 390 px (barre du bas), sombre et clair.
    for (const [cle, , chemin, , action] of VUES) {
      for (const [suffixe, largeur, hauteur, theme] of [
        ["clair-1366", 1366, 768, "light"],
        ["clair-1366-entiere", 1366, 768, "light"],
        ["clair-390", 390, 844, "light"],
        ["sombre-390", 390, 844, "dark"],
      ]) {
        const nom = `${cle}-${suffixe}`;
        const c = await contexte(navigateur, admin, { largeur, hauteur, theme });
        const p = await c.newPage();
        await ouvrir(p, chemin);
        await action?.(p);
        await p.screenshot({ path: join(RACINE, `${nom}.png`), fullPage: nom.endsWith("-entiere") || largeur < 1024 });
        rapport.largeurs[nom] = await mesures(p);
        await c.close();
      }
    }

    // 4. Largeurs de 320 à 1440 px : débordement, surtitre sur une ligne, entrées coupées, menu sans défilement.
    for (const largeur of [320, 390, 768, 1023, 1024, 1280, 1366, 1440]) {
      const c = await contexte(navigateur, admin, { largeur, hauteur: largeur >= 1024 ? 768 : 844, theme: "dark" });
      const p = await c.newPage();
      await ouvrir(p, "/fr/admin/reglages");
      rapport.largeurs[largeur] = await mesures(p);
      if (largeur === 1024) await p.screenshot({ path: join(RACINE, "reglages-sombre-1024.png") });
      await c.close();
    }

    // 5. Droits : l'Assistant ne voit pas « Utilisateurs ».
    const ca = await contexte(navigateur, assistant, { largeur: 1366, hauteur: 768, theme: "dark" });
    const pa = await ca.newPage();
    await ouvrir(pa, "/fr/admin/commandes");
    rapport.assistant = (await mesures(pa)).entrees;
    await pa.screenshot({ path: join(RACINE, "assistant-commandes-sombre-1366.png") });
    await ca.close();
    process.stdout.write("\n");
  } finally {
    await navigateur.close();
    try {
      // La commande d'abord : elle référence le Compte et les produits TEST_ (suppression refusée sinon).
      if (avecCommande()) {
        retirerCommandeTest();
        const restesCommande = await compterCommandeTest();
        console.log(`Commande TEST_ restante : ${restesCommande}`);
        if (restesCommande !== 0) process.exitCode = 1;
      }
      if (avecEvenement()) {
        retirerEvenementTest();
        const restesEvenement = await compterEvenementTest();
        console.log(`Événement TEST_ restant : ${restesEvenement}`);
        if (restesEvenement !== 0) process.exitCode = 1;
      }
      await nettoyer();
      if (avecProduits()) {
        await retirerProduitsTest();
        const restesProduits = await compterProduitsTest();
        console.log(`Produits et photos TEST_ restants : ${restesProduits}`);
        if (restesProduits !== 0) process.exitCode = 1;
      }
      if (avecArticles()) {
        await retirerArticlesTest();
        const restesArticles = await compterArticlesTest();
        console.log(`Articles et images TEST_ restants : ${restesArticles}`);
        if (restesArticles !== 0) process.exitCode = 1;
      }
      if (avecCodes()) {
        retirerCodesTest();
        const restesCodes = await compterCodesTest();
        console.log(`Codes promo TEST_ restants : ${restesCodes}`);
        if (restesCodes !== 0) process.exitCode = 1;
      }
    } finally {
      const restes = (await comptesTest()).length;
      console.log(`Comptes TEST_ restants : ${restes}`);
      if (restes !== 0) process.exitCode = 1;
    }
  }
  writeFileSync(join(RACINE, "rapport.json"), JSON.stringify(rapport, null, 2));
  ecrirePage();
  console.log(JSON.stringify(rapport, null, 2));
}

function ecrirePage() {
  const img = (f, alt) => `<a href="${f}"><img loading="lazy" src="${f}" alt="${alt}"></a>`;
  const sections = VUES.map(
    ([cle, libelle, , maquette]) =>
      maquette
        ? `<section id="${cle}"><h2>${libelle} · sombre · 1366 × 768</h2><p>Maquette à gauche, rendu à droite.</p>${img(`${cle}-cote-a-cote.jpg`, `${libelle} : maquette et rendu côte à côte`)}<p>Superposition à 50 % (rendu sur la maquette).</p>${img(`${cle}-superpose.jpg`, `${libelle} : superposition à 50 %`)}<p>Page entière (sombre).</p>${img(`${cle}-sombre-1366-entiere.png`, `${libelle} : page entière`)}</section>`
        : `<section id="${cle}"><h2>${libelle} · sombre · 1366 × 768 (pas de maquette)</h2>${img(`${cle}-sombre-1366.png`, `${libelle} : écran`)}<p>Page entière (sombre).</p>${img(`${cle}-sombre-1366-entiere.png`, `${libelle} : page entière`)}</section>`,
  );
  const autres = [
    ["menu-profil-sombre-1366.png", "Menu du profil ouvert (sombre, 1366)"],
    ["aide-sombre-1366.png", "Fenêtre « Aide » (sombre, 1366)"],
    ...VUES.flatMap(([cle, libelle]) => [
      [`${cle}-clair-1366.png`, `${libelle} en clair (1366)`],
      [`${cle}-clair-1366-entiere.png`, `${libelle} en clair, page entière (1366)`],
      [`${cle}-clair-390.png`, `${libelle} en clair à 390 px (barre du bas)`],
      [`${cle}-sombre-390.png`, `${libelle} en sombre à 390 px (barre du bas)`],
    ]),
    ["reglages-sombre-1024.png", "Réglages à 1024 px (surtitre sur une ligne)"],
    ["assistant-commandes-sombre-1366.png", "Assistant : menu sans « Utilisateurs »"],
  ].map(([f, l]) => `<section><h2>${l}</h2>${img(f, l)}</section>`);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cadre admin 9.16 b</title>
<style>:root{color-scheme:light dark;--fond:#f4efe6;--texte:#1b1713;--ligne:#cdbfa6}@media (prefers-color-scheme:dark){:root{--fond:#181512;--texte:#f4efe6;--ligne:#3a3430}}
body{margin:0;padding:16px;background:var(--fond);color:var(--texte);font:16px/1.5 system-ui,sans-serif}h2{font-size:18px;margin:32px 0 8px;border-top:1px solid var(--ligne);padding-top:16px}
img{max-width:100%;height:auto;border:1px solid var(--ligne)}</style></head><body><h1>Story 9.16 b) — cadre A de l'admin</h1>
<p>Rapport des mesures : <a href="rapport.json">rapport.json</a>. Dossier ignoré par Git.</p>${sections.join("\n")}${autres.join("\n")}</body></html>`;
  writeFileSync(join(RACINE, "index.html"), html);
  console.log(`page écrite : ${join(RACINE, "index.html")}`);
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
