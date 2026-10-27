// Statuts HTTP réels sur le build de production servi par `next start` (pas de `next dev`).
// Prérequis : `npm run build` déjà fait. Port libre choisi par le système ; le serveur est toujours arrêté à la fin.
// Aucun produit n'est créé : la fiche « dépubliée » est couverte par une adresse inexistante.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
if (!existsSync(join(racine, ".next", "BUILD_ID"))) {
  console.error("Aucun build de production : lance d'abord `npm run build`.");
  process.exit(1);
}

function portLibre() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

const port = await portLibre();
const base = `http://127.0.0.1:${port}`;
const serveur = spawn(process.execPath, [join(racine, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
  cwd: racine,
  env: { ...process.env, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? base },
  stdio: ["ignore", "pipe", "pipe"],
});
let journal = "";
serveur.stdout.on("data", (d) => (journal += d));
serveur.stderr.on("data", (d) => (journal += d));

// Windows : `next start` lance des processus enfants ; on arrête l'arbre entier.
function arreter() {
  if (serveur.exitCode !== null || serveur.pid === undefined) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(serveur.pid), "/t", "/f"], { stdio: "ignore" });
  else serveur.kill();
}
process.on("exit", arreter);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

const messagesNonTrouve = (langue) => JSON.parse(readFileSync(join(racine, "messages", `${langue}.json`), "utf8")).NonTrouve;
const DELAI_MS = 15000;
const demander = (adresse, suivre = false) => fetch(base + adresse, { redirect: suivre ? "follow" : "manual", signal: AbortSignal.timeout(DELAI_MS) });

const ATTENDUS = [
  // [adresse, statut attendu, suivre une redirection]
  ["/fr", 200],
  ["/fr/cosplays", 200],
  ["/fr/contact", 200],
  ["/en/accessoires", 308],
  ["/fr/zzz", 404],
  ["/en/zzz", 404],
  ["/fr/zzz/aaa", 404],
  ["/zzz", 404],
  ["/fr/cosplays/test-inexistant", 404],
  ["/fr/accessoires/test-inexistant", 404],
  ["/fr/cosplays/Test-Inexistant", 404],
  ["/fr/cosplays/test-inexistant/", 404, true], // une redirection au plus (barre finale), puis 404 final
  ["/fr/introuvable", 404],
  ["/en/cosplays/test-inexistant", 404],
  ["/en/accessories/test-inexistant", 404],
];

let echecs = 0;
try {
  let pret = false;
  for (let i = 0; i < 60 && !pret; i++) {
    if (serveur.exitCode !== null) throw new Error(`next start s'est arrêté :\n${journal}`);
    try {
      pret = (await demander("/fr")).status === 200;
      if (!pret) await new Promise((r) => setTimeout(r, 500));
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!pret) throw new Error(`next start ne répond pas :\n${journal}`);

  for (const [adresse, attendu, suivre] of ATTENDUS) {
    const r = await demander(adresse, suivre);
    let ok = r.status === attendu;
    let detail = "";
    // « /zzz » (hors langue) sert la 404 par défaut de Next : seul le statut est vérifié.
    if (attendu === 404 && (adresse.startsWith("/fr/") || adresse.startsWith("/en/"))) {
      const html = await r.text();
      const m = messagesNonTrouve(adresse.startsWith("/en") ? "en" : "fr");
      // La page « introuvable » garde son titre traduit, son noindex et son lien vers l'accueil.
      if (!html.includes(m.titre)) {
        ok = false;
        detail += " titre traduit absent";
      }
      if (!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html) && !/<meta[^>]+content="[^"]*noindex[^"]*"[^>]+name="robots"/i.test(html)) {
        ok = false;
        detail += " noindex absent";
      }
      if (!html.includes(m.lienAccueil)) {
        ok = false;
        detail += " lien accueil absent";
      }
    }
    if (attendu === 308 && !(r.headers.get("location") ?? "").endsWith("/en/accessories")) {
      ok = false;
      detail += " mauvaise cible";
    }
    console.log(`${ok ? "OK  " : "ECHEC"} ${r.status} (attendu ${attendu}) ${adresse}${detail}`);
    if (!ok) echecs++;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  echecs++;
} finally {
  arreter();
}
process.exit(echecs ? 1 : 0);
