// Story 7.8 : service worker du Scan. Enregistrement limité à la portée /fr/scan ou /en/scan (jamais ailleurs), et comportement du fichier public/sw-scan.js
// exécuté dans un contexte isolé avec des faux (caches, fetch) : page de Scan en cache, fichiers statiques en cache, rien d'autre, mise à jour maîtrisée.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { enregistrerServiceWorkerScan, FICHIER_SERVICE_WORKER, porteeScan, purgerCachePagesScan, urlServiceWorker } from "@/components/scan/service-worker";

describe("enregistrement", () => {
  it("la portée est celle de la page de Scan de la langue, rien d'autre", () => {
    expect(porteeScan("fr")).toBe("/fr/scan");
    expect(porteeScan("en")).toBe("/en/scan");
    for (const l of ["", "de", "/", "fr/scan", "../", "FR"]) expect(porteeScan(l), l).toBeNull();
  });
  it("enregistre /sw-scan.js avec la portée /fr/scan, sans jamais viser la racine", async () => {
    const register = vi.fn(async () => ({}) as ServiceWorkerRegistration);
    expect(await enregistrerServiceWorkerScan("fr", { navigateur: { serviceWorker: { register } }, production: true })).toBe("enregistre");
    expect(register).toHaveBeenCalledWith(urlServiceWorker(), { scope: "/fr/scan", updateViaCache: "none" });
    await enregistrerServiceWorkerScan("en", { navigateur: { serviceWorker: { register } }, production: true });
    expect(register).toHaveBeenLastCalledWith(urlServiceWorker(), { scope: "/en/scan", updateViaCache: "none" });
    for (const [, options] of register.mock.calls as unknown as [string, { scope: string }][]) expect(options.scope).not.toBe("/");
  });
  it("rien n'est enregistré en développement, sans service worker dans le navigateur, ou pour une langue inconnue", async () => {
    const register = vi.fn();
    expect(await enregistrerServiceWorkerScan("fr", { navigateur: { serviceWorker: { register } }, production: false })).toBe("indisponible");
    expect(await enregistrerServiceWorkerScan("fr", { navigateur: {}, production: true })).toBe("indisponible");
    expect(await enregistrerServiceWorkerScan("de", { navigateur: { serviceWorker: { register } }, production: true })).toBe("indisponible");
    expect(register).not.toHaveBeenCalled();
  });
  it("un enregistrement refusé par le navigateur n'est pas une erreur de l'écran", async () => {
    const register = vi.fn(async () => {
      throw new Error("TEST_refus");
    });
    expect(await enregistrerServiceWorkerScan("fr", { navigateur: { serviceWorker: { register } }, production: true })).toBe("echec");
  });
  it("seul l'écran de Scan appelle l'enregistrement", () => {
    const sources = ["src/app", "src/components", "src/lib", "src/modules"];
    const utilisations: string[] = [];
    const parcourir = (dossier: string) => {
      for (const e of readdirSyncRecursif(dossier)) {
        if (/\.(ts|tsx)$/.test(e) && readFileSync(e, "utf8").includes("enregistrerServiceWorkerScan(")) utilisations.push(e.replace(/\\/g, "/"));
      }
    };
    sources.forEach(parcourir);
    expect(utilisations.sort()).toEqual(["src/components/scan/EcranScan.tsx", "src/components/scan/service-worker.ts"]);
  });
});

function readdirSyncRecursif(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? readdirSyncRecursif(chemin) : [chemin];
  });
}

// ---------- Fichier public/sw-scan.js exécuté avec des faux ----------
type Reponse = { ok: boolean; redirected: boolean; type: string; headers: Headers; tag: string; clone: () => Reponse; text: () => Promise<string> };
const REPERE = 'data-koma-ecran-scan="1"';
// Par défaut une page HTML qui porte le repère de l'écran de Scan ; « tag » sert à reconnaître la réponse.
const reponse = (tag: string, options: Partial<Reponse> & { corps?: string } = {}): Reponse => {
  const { corps, ...reste } = options;
  const r: Reponse = { ok: true, redirected: false, type: "basic", headers: new Headers({ "content-type": "text/html; charset=utf-8" }), tag, clone: () => r, text: async () => corps ?? `<div ${REPERE}>${tag}</div>`, ...reste };
  return r;
};

function monter() {
  const gestionnaires: Record<string, (e: unknown) => void> = {};
  const magasins = new Map<string, Map<string, Reponse>>();
  const caches = {
    open: async (nom: string) => {
      if (!magasins.has(nom)) magasins.set(nom, new Map());
      const m = magasins.get(nom) as Map<string, Reponse>;
      return { match: async (r: { url: string }) => m.get(r.url)?.clone(), put: async (r: { url: string }, rep: Reponse) => void m.set(r.url, rep) };
    },
    keys: async () => [...magasins.keys()],
    delete: async (nom: string) => magasins.delete(nom),
  };
  const fetchFaux = vi.fn<(r: { url: string }) => Promise<Reponse>>();
  const self = {
    location: { origin: "https://exemple.test", href: "https://exemple.test/sw-scan.js?v=abc" },
    addEventListener: (nom: string, f: (e: unknown) => void) => void (gestionnaires[nom] = f),
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(),
  };
  runInNewContext(readFileSync("public/sw-scan.js", "utf8"), { self, caches, fetch: fetchFaux, URL, Request, Response });
  const requete = (url: string, options: { method?: string; mode?: string } = {}) => ({ url, method: options.method ?? "GET", mode: options.mode ?? "cors" });
  // Rend la promesse donnée à respondWith, ou null si le service worker n'intercepte pas la requête.
  const attentes: Promise<unknown>[] = [];
  function envoyer(url: string, options: { method?: string; mode?: string } = {}): Promise<Reponse> | null {
    let repondu: Promise<Reponse> | null = null;
    gestionnaires.fetch({
      request: requete(url, options),
      respondWith: (p: Promise<Reponse>) => void (repondu = p),
      waitUntil: (p: Promise<unknown>) => void attentes.push(p),
    });
    return repondu;
  }
  // Attend les copies faites en arrière-plan (waitUntil).
  const attendre = async () => void (await Promise.all(attentes.splice(0)));
  return { gestionnaires, magasins, fetchFaux, self, envoyer, attendre };
}

describe("public/sw-scan.js", () => {
  it("n'intercepte que la page de Scan (navigation) et les fichiers statiques : tout le reste passe tel quel", async () => {
    const sw = monter();
    for (const [url, options] of [
      ["https://exemple.test/fr/scan", { method: "POST", mode: "navigate" }],
      ["https://exemple.test/fr/scan?_rsc=abc", { mode: "cors" }],
      ["https://exemple.test/fr/admin", { mode: "navigate" }],
      ["https://exemple.test/fr/compte/pass", { mode: "navigate" }],
      ["https://exemple.test/fr/scanner", { mode: "navigate" }],
      ["https://exemple.test/api/sante", { mode: "cors" }],
      ["https://exemple.test/_next/image?url=a&w=64&q=75", { mode: "cors" }],
      ["https://autre.test/_next/static/chunks/a.js", { mode: "cors" }],
    ] as const) {
      expect(await sw.envoyer(url, options), `${options.method ?? "GET"} ${url}`).toBeNull();
    }
    expect(sw.fetchFaux).not.toHaveBeenCalled();
    expect(sw.magasins.size).toBe(0);
  });

  it("page de Scan : le réseau d'abord (et copie), sans réseau la dernière copie, sans copie l'erreur du réseau", async () => {
    const sw = monter();
    sw.fetchFaux.mockResolvedValueOnce(reponse("fraiche"));
    expect((await sw.envoyer("https://exemple.test/fr/scan", { mode: "navigate" }))?.tag).toBe("fraiche");
    await sw.attendre();
    sw.fetchFaux.mockRejectedValueOnce(new TypeError("TEST_hors_ligne"));
    const copie = await sw.envoyer("https://exemple.test/fr/scan/", { mode: "navigate" });
    expect(await (copie as unknown as Response).text()).toContain("fraiche");
    // L'autre langue n'a pas de copie : l'erreur du réseau remonte.
    sw.fetchFaux.mockRejectedValueOnce(new TypeError("TEST_hors_ligne"));
    await expect(sw.envoyer("https://exemple.test/en/scan", { mode: "navigate" }) as Promise<Reponse>).rejects.toThrow("TEST_hors_ligne");
  });

  it("jamais de copie d'une page redirigée, en erreur, étrangère, sans le repère de l'écran de Scan : la bonne copie n'est jamais remplacée", async () => {
    const sw = monter();
    sw.fetchFaux.mockResolvedValueOnce(reponse("bonne"));
    await sw.envoyer("https://exemple.test/fr/scan", { mode: "navigate" });
    await sw.attendre();
    for (const r of [
      reponse("redirigee", { redirected: true }),
      reponse("erreur", { ok: false }),
      reponse("opaque", { type: "opaqueredirect" }),
      reponse("json", { headers: new Headers({ "content-type": "application/json" }) }),
      // Session expirée en ligne : la page de connexion (ou d'accès refusé) ne porte pas le repère.
      reponse("connexion", { corps: "<html><body>Connexion</body></html>" }),
    ]) {
      sw.fetchFaux.mockResolvedValueOnce(r);
      await sw.envoyer("https://exemple.test/fr/scan", { mode: "navigate" });
      await sw.attendre();
      sw.fetchFaux.mockRejectedValueOnce(new TypeError("TEST_hors_ligne"));
      const copie = await sw.envoyer("https://exemple.test/fr/scan", { mode: "navigate" });
      expect(await (copie as unknown as Response).text(), r.tag).toContain("bonne");
    }
  });

  it("fichiers statiques et logos : la copie d'abord, sinon réseau puis copie ; une erreur serveur n'est pas gardée", async () => {
    const sw = monter();
    sw.fetchFaux.mockResolvedValue(reponse("script", { headers: new Headers({ "content-type": "text/javascript" }) }));
    const url = "https://exemple.test/_next/static/chunks/a1b2.js";
    expect((await sw.envoyer(url))?.tag).toBe("script");
    sw.fetchFaux.mockClear();
    expect((await sw.envoyer(url))?.tag).toBe("script");
    expect(sw.fetchFaux).not.toHaveBeenCalled();
    sw.fetchFaux.mockResolvedValueOnce(reponse("cassee", { ok: false }));
    await sw.envoyer("https://exemple.test/_next/static/chunks/zz.js");
    sw.fetchFaux.mockClear();
    sw.fetchFaux.mockResolvedValueOnce(reponse("neuve"));
    expect((await sw.envoyer("https://exemple.test/_next/static/chunks/zz.js"))?.tag).toBe("neuve");
    expect(await sw.envoyer("https://exemple.test/logo/logo-principal.svg")).not.toBeNull();
  });

  it("mise à jour maîtrisée : pas de skipWaiting tout seul, activation qui prend la main et supprime les anciens caches de Scan seulement", async () => {
    const sw = monter();
    sw.gestionnaires.install({});
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    sw.magasins.set("koma-scan-v0-pages", new Map());
    sw.magasins.set("autre-cache", new Map());
    let attente: Promise<unknown> = Promise.resolve();
    sw.gestionnaires.activate({ waitUntil: (p: Promise<unknown>) => void (attente = p) });
    await attente;
    expect(sw.magasins.has("koma-scan-v0-pages")).toBe(false);
    expect(sw.magasins.has("autre-cache")).toBe(true);
    expect(sw.self.clients.claim).toHaveBeenCalled();
    sw.gestionnaires.message({ data: "autre" });
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    sw.gestionnaires.message({ data: "passer" });
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("le fichier ne met rien d'autre en cache : ni API, ni POST, ni données du Scan", () => {
    // Code seul : les commentaires expliquent justement ce qui n'est pas fait.
    const source = readFileSync("public/sw-scan.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(source).not.toMatch(/indexedDB|localStorage|\/api\/|jeton|code_court/);
    expect(source).not.toMatch(/cache\.addAll|importScripts/);
  });
});

describe("correctifs de revue", () => {
  it("l'adresse d'enregistrement porte l'identifiant du déploiement (nouveau service worker, caches purgés, à chaque déploiement)", () => {
    expect(urlServiceWorker()).toMatch(/^\/sw-scan\.js\?v=[A-Za-z0-9_-]+$/);
    expect(urlServiceWorker().startsWith(FICHIER_SERVICE_WORKER)).toBe(true);
  });
  it("à l'activation, les caches de la version courante restent, ceux des autres versions partent", async () => {
    const sw = monter();
    sw.magasins.set("koma-scan-abc-pages", new Map());
    sw.magasins.set("koma-scan-abc-statique", new Map());
    sw.magasins.set("koma-scan-zzz-pages", new Map());
    let attente: Promise<unknown> = Promise.resolve();
    sw.gestionnaires.activate({ waitUntil: (p: Promise<unknown>) => void (attente = p) });
    await attente;
    expect([...sw.magasins.keys()].sort()).toEqual(["koma-scan-abc-pages", "koma-scan-abc-statique"]);
  });
  it("logos : la copie est servie aussitôt et rafraîchie en arrière-plan ; sans copie, le réseau ; sans les deux, une erreur", async () => {
    const sw = monter();
    const url = "https://exemple.test/logo/logo-principal.svg";
    sw.fetchFaux.mockResolvedValueOnce(reponse("v1", { headers: new Headers({ "content-type": "image/svg+xml" }) }));
    expect((await sw.envoyer(url))?.tag).toBe("v1");
    await sw.attendre();
    sw.fetchFaux.mockResolvedValueOnce(reponse("v2", { headers: new Headers({ "content-type": "image/svg+xml" }) }));
    expect((await sw.envoyer(url))?.tag).toBe("v1");
    await sw.attendre();
    sw.fetchFaux.mockRejectedValueOnce(new TypeError("TEST_hors_ligne"));
    expect((await sw.envoyer(url))?.tag).toBe("v2");
    await sw.attendre();
    sw.fetchFaux.mockRejectedValueOnce(new TypeError("TEST_hors_ligne"));
    await expect(sw.envoyer("https://exemple.test/logo/autre.svg") as Promise<Reponse>).rejects.toThrow();
  });
  it("purge des copies de la page de Scan pour un autre Compte : les pages seulement", async () => {
    const supprimes: string[] = [];
    await purgerCachePagesScan({ keys: async () => ["koma-scan-abc-pages", "koma-scan-abc-statique", "autre"], delete: async (n: string) => (supprimes.push(n), true) });
    expect(supprimes).toEqual(["koma-scan-abc-pages"]);
    await expect(purgerCachePagesScan(undefined)).resolves.toBeUndefined();
  });
  it("le service worker n'intercepte que les adresses exactes /fr/scan et /en/scan (pas /fr/scanner ni /fr/scan/x)", async () => {
    const sw = monter();
    for (const u of ["https://exemple.test/fr/scanner", "https://exemple.test/fr/scan/x", "https://exemple.test/fr/scan-x"]) expect(await sw.envoyer(u, { mode: "navigate" }), u).toBeNull();
  });
});
