// Story 9.16 a) : captures avant/après le passage à KOMA Chikara, et mesure du CLS de l'accueil.
// Usage : contre un build de production lancé par `npm start -- -p 3200` (adresse modifiable par CAPTURES_URL) ; étapes : voir `principal`.
// Sortie : docs/captures-police/ (ignoré par Git, jamais commité).
// Données TEST_ sur la base de .env.local (koma-dev) : un produit TEST_ publié (photo dessinée ici, aucune image tierce) et un
// deux Comptes TEST_ (un avec le rôle admin, un client sans rôle pour /compte, que le proxy renvoie vers /admin pour un admin),
// créés au début et TOUS supprimés à la fin, même en cas d'échec, puis comptés (0 attendu).
// CAPTURES_PAGES=compte,fiche (facultatif) : ne refait que ces pages ; le fichier des débordements n'est alors pas réécrit.
// Aucun paiement, aucune notification ni aucun statut simulé (règle 13) : le panier reste un panier, rien n'est commandé.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const RACINE = "docs/captures-police";
const BASE = (process.env.CAPTURES_URL ?? "http://localhost:3200").replace(/\/+$/, "");
const AUTEUR = `{"type":"systeme","nom":"captures 9.16 TEST"}`;
const ID = "00000000-0000-4000-8916-000000000001";
const SLUG = "test-captures-916-polo";
const TITRE = "TEST_ Polo 鬼滅の刃 🔥";
const FICHIER = "test-captures-916/polo.jpg";
const EMAIL_PREFIXE = "test-captures-916-";
const LARGEURS = [1440, 1024, 390];
const THEMES = ["light", "dark"];

// Pages capturées : [clé, libellé, chemin, session (visiteur, admin ou client), action avant la capture].
const PAGES = [
  ["accueil", "Accueil visiteur", "/fr", "visiteur", null],
  ["entete-boutique", "En-tête, menu « Boutique » ouvert", "/fr", "visiteur", "boutique"],
  ["fiche", "Fiche produit", `/fr/vetements/${SLUG}`, "visiteur", null],
  ["panier", "Panier", "/fr/panier", "admin", null],
  ["connexion", "Connexion", "/fr/connexion", "visiteur", null],
  ["compte", "/compte (Compte client)", "/fr/compte", "client", null],
  ["admin", "Admin : tableau de bord", "/fr/admin", "admin", null],
  ["admin-commandes", "Admin : commandes", "/fr/admin/commandes", "admin", null],
  ["admin-produits", "Admin : produits", "/fr/admin/produits", "admin", null],
];
const FILTRE = (process.env.CAPTURES_PAGES ?? "").split(",").map((c) => c.trim()).filter(Boolean);
const PAGES_CHOISIES = FILTRE.length > 0 ? PAGES.filter(([cle]) => FILTRE.includes(cle)) : PAGES;

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

function sql(requete) {
  const dossier = mkdtempSync(join(tmpdir(), "captures-916-"));
  const fichier = join(dossier, "requete.sql");
  writeFileSync(fichier, ["do $bloc$", "begin", `perform set_config('ks.auteur', '${AUTEUR}', true);`, requete, "end", "$bloc$;"].join("\n"));
  const r = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", fichier], { encoding: "utf8", shell: true });
  rmSync(dossier, { recursive: true, force: true });
  if (r.status !== 0 || /"error"|ERROR/.test(r.stdout + r.stderr)) throw new Error(`SQL en échec : ${(r.stdout + r.stderr).slice(0, 1200)}`);
}

async function comptesTest() {
  const { data, error } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`liste des Comptes : ${error.message}`);
  return data.users.filter((u) => (u.email ?? "").startsWith(EMAIL_PREFIXE)).map((u) => u.id);
}

async function nettoyer() {
  const comptes = await comptesTest();
  const liste = comptes.length > 0 ? comptes.map((c) => `'${c}'`).join(",") : "null";
  sql(`delete from public.ligne_panier where produit_id = '${ID}' or panier_id in (select id from public.panier where compte_id in (${liste}));
delete from public.panier where compte_id in (${liste});
alter table public.produit disable trigger produit_publie_complet;
delete from public.produit_photo where produit_id = '${ID}';
delete from public.variante where produit_id = '${ID}';
delete from public.produit where id = '${ID}' or slug like 'test-captures-916-%';
alter table public.produit enable trigger produit_publie_complet;`);
  await service.storage.from("produits-public").remove([FICHIER]);
  for (const id of comptes) {
    const { error } = await service.auth.admin.deleteUser(id);
    // Un Compte déjà absent (liste lue juste avant une suppression concurrente) est un Compte supprimé.
    if (error && !/not found/i.test(error.message)) throw new Error(`suppression du Compte TEST_ impossible : ${error.message}`);
  }
}

async function compterRestes() {
  const compter = async (table, colonne) => {
    const { count, error } = await service.from(table).select("*", { count: "exact", head: true }).eq(colonne, ID);
    if (error || count === null) throw new Error(`comptage de ${table} impossible : ${error?.message}`);
    return count;
  };
  const { data } = await service.storage.from("produits-public").list("test-captures-916");
  return {
    produits: await compter("produit", "id"),
    variantes: await compter("variante", "produit_id"),
    photos: await compter("produit_photo", "produit_id"),
    lignes_panier: await compter("ligne_panier", "produit_id"),
    comptes: (await comptesTest()).length,
    fichiers: (data ?? []).length,
  };
}

async function semer() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3430"/><stop offset="1" stop-color="#1c1916"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/></svg>`;
  const photo = await sharp(Buffer.from(svg)).jpeg().toBuffer();
  const envoi = await service.storage.from("produits-public").upload(FICHIER, photo, { upsert: true, contentType: "image/jpeg" });
  if (envoi.error) throw new Error(`envoi de la photo impossible : ${envoi.error.message}`);
  sql(`alter table public.produit disable trigger produit_publie_complet;
insert into public.produit (id, famille, slug, titre_fr, titre_en, description_fr, description_en, prix_cents) values
  ('${ID}', 'vetement', '${SLUG}', '${TITRE}', 'TEST_ Polo 鬼滅の刃 🔥 EN', 'TEST_ description de démonstration', 'TEST_ demo description', 2500);
insert into public.produit_photo (produit_id, fichier, position, alt_fr, alt_en) values
  ('${ID}', '${FICHIER}', 1, 'TEST_ photo de démonstration du polo', 'TEST_ demo photo of the polo shirt');
insert into public.variante (produit_id, taille, couleur_fr, couleur_en, couleur_hex, stock) values
  ('${ID}', 'M', 'Noir', 'Black', '#1B1713', 5);
update public.produit set publie_le = now() - interval '1 hour' where id = '${ID}';
alter table public.produit enable trigger produit_publie_complet;`);
}

// Compte TEST_ réel (rôle admin, ou client sans rôle) ; renvoie les cookies de session à poser dans chaque contexte du navigateur.
async function sessionTest(admin) {
  const email = `${EMAIL_PREFIXE}${Date.now()}@example.invalid`;
  const cree = await service.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: "TEST Captures" } });
  if (cree.error || !cree.data.user) throw new Error(`création du Compte TEST_ impossible : ${cree.error?.message}`);
  const id = cree.data.user.id;
  const etapes = [
    ["declarer_age", { p_auteur: { type: "systeme", nom: "captures 9.16 TEST" }, p_compte: id, p_age: 25 }],
    ["enregistrer_questions_accueil", { p_auteur: { type: "compte", id, role: null }, p_compte: id, p_origine: null, p_preference: null }],
    ...(admin ? [["attribuer_role", { p_auteur: { type: "systeme", nom: "captures 9.16 TEST" }, p_compte: id, p_role: "admin" }]] : []),
  ];
  for (const [fn, args] of etapes) {
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

async function attendreStable(page) {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

// Ajoute le produit TEST_ au panier du Compte TEST_ et renvoie l'état du navigateur (cookies de session et du panier, stockage),
// réutilisé tel quel par chaque contexte connecté : un seul ajout, quel que soit le nombre de captures.
async function remplirPanier(navigateur, cookies) {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/fr/vetements/${SLUG}`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Ajouter au panier" }).waitFor();
  // Une seule couleur ou une seule taille peut être déjà choisie : chaque choix n'est cliqué que s'il est proposé.
  for (const [groupe, valeur] of [["Couleur", "Noir"], ["Taille", "M"]]) {
    const choix = page.getByRole("group", { name: groupe }).getByText(valeur, { exact: true });
    if ((await choix.count()) > 0) await choix.click();
  }
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.getByRole("status").filter({ hasText: "Ajouté au panier" }).waitFor();
  const etat = await ctx.storageState();
  await ctx.close();
  return etat;
}

async function ouvrirMenuBoutique(page) {
  const boutique = page.getByRole("button", { name: "Boutique" });
  if (await boutique.isVisible()) return boutique.click();
  // Téléphone : le menu « Boutique » est dans le menu principal.
  const menu = page.getByRole("button", { name: /menu/i }).first();
  if (await menu.isVisible()) await menu.click();
}

async function capturer(navigateur, phase, etats) {
  const dossier = join(RACINE, phase);
  mkdirSync(dossier, { recursive: true });
  const debordements = [];
  for (const theme of THEMES) {
    for (const largeur of LARGEURS) {
      // Un contexte par session : visiteur (connecté en admin, /fr mène au tableau de bord), admin, client.
      const contextes = {};
      for (const session of ["visiteur", "admin", "client"]) {
        const ctx = await navigateur.newContext({
          viewport: { width: largeur, height: largeur === 390 ? 844 : 900 },
          reducedMotion: "reduce",
          ...(etats[session] ? { storageState: etats[session] } : {}),
        });
        await ctx.addInitScript((t) => {
          try {
            window.localStorage.setItem("ks-theme", t);
          } catch {}
        }, theme);
        contextes[session] = { ctx, page: await ctx.newPage() };
      }
      for (const [cle, , chemin, session, action] of PAGES_CHOISIES) {
        const { page } = contextes[session];
        const reponse = await page.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded" });
        // Une redirection (session refusée, rôle) donnerait la capture d'une autre page : arrêt.
        const arrivee = new URL(page.url()).pathname;
        if (arrivee.replace(/\/$/, "") !== chemin.split("?")[0]) throw new Error(`${cle} : ${chemin} a mené à ${arrivee} (HTTP ${reponse?.status()})`);
        await attendreStable(page);
        if (action === "boutique") {
          await ouvrirMenuBoutique(page);
          await page.waitForTimeout(300);
        }
        const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        if (deborde) debordements.push(`${cle} ${theme} ${largeur}`);
        await page.screenshot({ path: join(dossier, `${cle}-${theme}-${largeur}.jpg`), fullPage: action !== "boutique", type: "jpeg", quality: 72 });
        process.stdout.write(".");
      }
      for (const { ctx } of Object.values(contextes)) await ctx.close();
    }
  }
  process.stdout.write("\n");
  return debordements;
}

// CLS de l'accueil : contexte neuf (cache vide), somme des décalages sans saisie récente, médiane de 3 chargements.
async function mesurerCls(navigateur) {
  const resultats = {};
  for (const [nom, reseau] of [
    ["direct", null],
    ["4G lent", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }],
  ]) {
    for (const largeur of [390, 1440]) {
      const valeurs = [];
      for (let i = 0; i < 3; i++) {
        const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 900 } });
        const page = await ctx.newPage();
        if (reseau) {
          const cdp = await ctx.newCDPSession(page);
          await cdp.send("Network.enable");
          await cdp.send("Network.emulateNetworkConditions", reseau);
        }
        await page.addInitScript(() => {
          window.__cls = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        });
        await page.goto(`${BASE}/fr`, { waitUntil: "load", timeout: 120_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(2500);
        valeurs.push(await page.evaluate(() => window.__cls));
        await ctx.close();
      }
      valeurs.sort((a, b) => a - b);
      resultats[`${nom} ${largeur} px`] = Number(valeurs[1].toFixed(4));
    }
  }
  return resultats;
}

function ecrirePage() {
  const lire = (phase) => (existsSync(join(RACINE, phase)) ? new Set(readdirSync(join(RACINE, phase))) : new Set());
  const avant = lire("avant");
  const apres = lire("apres");
  const cls = (phase) => readFileSafe(join(RACINE, `cls-${phase}.json`));
  const sections = [];
  for (const [cle, libelle] of PAGES) {
    for (const theme of THEMES) {
      for (const largeur of LARGEURS) {
        const f = `${cle}-${theme}-${largeur}.jpg`;
        const cellule = (phase, ens) => (ens.has(f) ? `<a href="${phase}/${f}"><img loading="lazy" src="${phase}/${f}" alt="${phase} : ${libelle}, ${theme === "light" ? "clair" : "sombre"}, ${largeur} px"></a>` : `<p class="vide">absente</p>`);
        sections.push(`<section id="${cle}-${theme}-${largeur}"><h2>${libelle} · ${theme === "light" ? "clair" : "sombre"} · ${largeur} px</h2><div class="paire"><figure><figcaption>Avant (Barlow)</figcaption>${cellule("avant", avant)}</figure><figure><figcaption>Après (KOMA Chikara)</figcaption>${cellule("apres", apres)}</figure></div></section>`);
      }
    }
  }
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Captures police 9.16 a)</title>
<style>:root{color-scheme:light dark;--fond:#f4efe6;--texte:#1b1713;--ligne:#cdbfa6}@media (prefers-color-scheme:dark){:root{--fond:#181512;--texte:#f4efe6;--ligne:#3a3430}}
body{margin:0;padding:16px;background:var(--fond);color:var(--texte);font:16px/1.5 system-ui,sans-serif}h1{font-size:24px}h2{font-size:18px;margin:32px 0 8px;border-top:1px solid var(--ligne);padding-top:16px}
.paire{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}img{width:100%;height:auto;border:1px solid var(--ligne)}
nav{columns:3 220px}nav a{display:block;color:inherit}pre{background:rgba(127,127,127,.12);padding:8px;overflow:auto}.vide{opacity:.6}</style></head><body>
<h1>Story 9.16 a) — captures avant / après KOMA Chikara</h1>
<p>9 pages × clair et sombre × 1440, 1024 et 390 px. Cliquer une capture pour l'ouvrir en taille réelle. Dossier ignoré par Git.</p>
<h2>CLS de l'accueil (/fr, médiane de 3, cache vide)</h2><pre>Avant : ${cls("avant")}\nAprès : ${cls("apres")}</pre>
<h2>Débordements horizontaux détectés</h2><pre>Avant : ${readFileSafe(join(RACINE, "debordements-avant.json"))}\nAprès : ${readFileSafe(join(RACINE, "debordements-apres.json"))}</pre>
<nav>${sections.map((s) => s.match(/id="([^"]+)"/)[1]).map((id) => `<a href="#${id}">${id}</a>`).join("")}</nav>
${sections.join("\n")}</body></html>`;
  writeFileSync(join(RACINE, "index.html"), html);
  console.log(`page écrite : ${join(RACINE, "index.html")}`);
}

function readFileSafe(chemin) {
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    return "—";
  }
}

// Étapes (le catalogue est en cache dans le serveur de production : le produit TEST_ est semé AVANT de (re)lancer `npm start`) :
//   cls avant|apres       mesure du CLS de l'accueil (serveur lancé, aucune donnée TEST_)
//   semer                 produit TEST_ publié ; relancer ensuite le serveur
//   captures avant|apres  Comptes TEST_ admin et client, panier, 54 captures ; à la fin TOUT est supprimé et compté
//   nettoyer              suppression seule (reprise après incident)
//   page                  page de comparaison
async function principal() {
  const [etape, phase] = process.argv.slice(2);
  mkdirSync(RACINE, { recursive: true });
  if (etape === "page") return ecrirePage();
  if (etape === "semer") {
    await nettoyer();
    return semer();
  }
  if (etape === "nettoyer") {
    await nettoyer();
    return console.log(`données TEST_ restantes : ${JSON.stringify(await compterRestes())}`);
  }
  if ((etape !== "cls" && etape !== "captures") || (phase !== "avant" && phase !== "apres")) {
    throw new Error("usage : node scripts/captures-police.mjs cls|captures avant|apres, ou semer|nettoyer|page");
  }
  const navigateur = await chromium.launch();
  if (etape === "cls") {
    try {
      const cls = await mesurerCls(navigateur);
      writeFileSync(join(RACINE, `cls-${phase}.json`), JSON.stringify(cls));
      return console.log(`CLS ${phase} : ${JSON.stringify(cls)}`);
    } finally {
      await navigateur.close();
    }
  }
  try {
    const admin = await remplirPanier(navigateur, await sessionTest(true));
    const client = { cookies: await sessionTest(false), origins: [] };
    const debordements = await capturer(navigateur, phase, { admin, client });
    if (FILTRE.length === 0) writeFileSync(join(RACINE, `debordements-${phase}.json`), JSON.stringify(debordements));
    console.log(`débordements ${phase} : ${JSON.stringify(debordements)}`);
  } finally {
    await navigateur.close();
    try {
      await nettoyer();
    } finally {
      const restes = await compterRestes();
      console.log(`données TEST_ restantes : ${JSON.stringify(restes)}`);
      if (Object.values(restes).some((n) => n !== 0)) process.exitCode = 1;
    }
  }
  ecrirePage();
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
