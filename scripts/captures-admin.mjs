// Story 9.16 b) : captures du cadre A de l'admin comparées aux maquettes, et contrôles de mise en page.
// Usage : contre un build de production lancé par `npm start -- -p 3200` (adresse modifiable par CAPTURES_URL) : `node scripts/captures-admin.mjs`.
// Sortie : docs/captures-admin/9-16-b/ (ignoré par Git, jamais commité) et index.html pour la revue. Pages de l'étape 4 (9.16 c et suivantes) :
// CAPTURES_SORTIE (dossier, par exemple docs/captures-admin/9-16-c) et CAPTURES_VUES (clés séparées par des virgules, par exemple « tableau »).
// Maquettes lues dans docs/references/maquettes-admin/ (ignoré par Git).
// Deux Comptes TEST_ réels sur la base de .env.local (koma-dev) : un Admin et un Assistant, créés au début et TOUS supprimés à la fin, même en cas d'échec,
// puis comptés (0 attendu). Aucune donnée de boutique n'est créée ; aucun paiement, aucune notification ni aucun statut simulé (règle 13).
import { mkdirSync, writeFileSync } from "node:fs";
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
];
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
    await nettoyer();
    const admin = await sessionTest("admin");
    const assistant = await sessionTest("assistant");

    // 1. Les 7 vues à 1366 × 768 en sombre, comparées aux maquettes.
    const ctx = await contexte(navigateur, admin, { largeur: 1366, hauteur: 768, theme: "dark" });
    const page = await ctx.newPage();
    for (const [cle, , chemin, maquette] of VUES) {
      await ouvrir(page, chemin);
      const fichier = join(RACINE, `${cle}-sombre-1366.png`);
      await page.screenshot({ path: fichier });
      await page.screenshot({ path: join(RACINE, `${cle}-sombre-1366-entiere.png`), fullPage: true });
      await comparer(cle, maquette, fichier);
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
    for (const [cle, , chemin] of VUES) {
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
      await nettoyer();
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
    ([cle, libelle]) =>
      `<section id="${cle}"><h2>${libelle} · sombre · 1366 × 768</h2><p>Maquette à gauche, rendu à droite.</p>${img(`${cle}-cote-a-cote.jpg`, `${libelle} : maquette et rendu côte à côte`)}<p>Superposition à 50 % (rendu sur la maquette).</p>${img(`${cle}-superpose.jpg`, `${libelle} : superposition à 50 %`)}<p>Page entière (sombre).</p>${img(`${cle}-sombre-1366-entiere.png`, `${libelle} : page entière`)}</section>`,
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
