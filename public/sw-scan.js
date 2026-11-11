/* Service worker de l'écran de Scan (story 7.8, AD-12).
 *
 * Portée LIMITÉE à /fr/scan et /en/scan (enregistré seulement depuis la page de Scan, avec ces portées). Rôle unique : que la page de Scan et ses
 * ressources statiques s'ouvrent sans réseau, pour le Scan hors ligne.
 *
 * Ce qui est mis en cache :
 *   - la page de Scan elle-même (navigation vers /fr/scan ou /en/scan), réseau d'abord : quand il y a du réseau, la page fraîche est servie et recopiée ;
 *     sans réseau, la dernière copie est servie. Seule une page qui porte le repère de l'écran de Scan est recopiée : une réponse redirigée, en erreur,
 *     qui n'est pas du HTML, ou une page de connexion / d'accès refusé ne remplace jamais la bonne copie.
 *     Cette page ne contient que la liste des Événements que le Compte peut scanner (titres) : aucun Pass, aucun nom, aucun jeton.
 *   - les fichiers statiques du site sous /_next/static/ (scripts, styles, polices, module WebAssembly du lecteur de Code QR) : leur nom contient leur
 *     empreinte, un fichier ne change jamais sous le même nom (la copie passe d'abord). /logo/ : copie servie aussitôt, rafraîchie en arrière-plan.
 * Ce qui n'est JAMAIS mis en cache : les actions serveur (POST), toute réponse d'API, les requêtes RSC, les images optimisées, les autres pages du site.
 * Les données du Scan (liste des Pass, scans) vivent dans IndexedDB, jamais ici.
 *
 * Mise à jour maîtrisée : pas de skipWaiting automatique. Une nouvelle version attend la fermeture des onglets de Scan, sauf si la page le demande
 * explicitement par un message « passer ». À l'activation, les caches d'anciennes versions sont supprimés.
 */
// La version vient de l'adresse d'enregistrement (?v=<identifiant du déploiement>) : chaque déploiement installe un nouveau service worker, qui purge les caches
// des versions précédentes à son activation.
const VERSION = "koma-scan-" + (new URL(self.location.href).searchParams.get("v") || "0");
const CACHE_PAGES = VERSION + "-pages";
const CACHE_STATIQUE = VERSION + "-statique";
const PAGE_DE_SCAN = /^\/(fr|en)\/scan\/?$/;
// Repère posé par la page de Scan quand elle affiche l'écran de Scan lui-même. Une page de connexion, d'accès refusé ou d'erreur ne le porte pas : elle ne
// remplace jamais la bonne copie (un bénévole dont la session expire en ligne garde sa page de Scan pour la coupure suivante).
const REPERE_ECRAN_SCAN = "data-koma-ecran-scan";

self.addEventListener("install", () => {
  // Rien à précharger ici : les ressources entrent dans le cache quand la page de Scan les demande (voir « fetch »).
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    (async () => {
      for (const nom of await caches.keys()) {
        if (nom.startsWith("koma-scan-") && nom !== CACHE_PAGES && nom !== CACHE_STATIQUE) await caches.delete(nom);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (evenement) => {
  if (evenement.data === "passer") self.skipWaiting();
});

function cleDePage(url) {
  return new Request(url.origin + url.pathname.replace(/\/$/, ""));
}

async function pageDeScan(evenement, requete, url) {
  const cache = await caches.open(CACHE_PAGES);
  try {
    const reponse = await fetch(requete);
    const type = reponse.headers.get("content-type") || "";
    if (reponse.ok && !reponse.redirected && reponse.type === "basic" && type.includes("text/html")) {
      // La copie est lue à part : elle ne retarde pas la page servie.
      const copie = reponse.clone();
      evenement.waitUntil(
        copie
          .text()
          .then((texte) => (texte.includes(REPERE_ECRAN_SCAN) ? cache.put(cleDePage(url), new Response(texte, { headers: { "content-type": type } })) : undefined))
          .catch(() => undefined),
      );
    }
    return reponse;
  } catch (erreur) {
    const copie = await cache.match(cleDePage(url));
    if (copie) return copie;
    throw erreur;
  }
}

// Logos : servis tout de suite depuis la copie, rafraîchie en arrière-plan (leur nom ne change pas, leur contenu peut changer).
async function ressourceRafraichie(evenement, requete) {
  const cache = await caches.open(CACHE_STATIQUE);
  const copie = await cache.match(requete);
  const frais = fetch(requete)
    .then(async (reponse) => {
      if (reponse.ok && reponse.type === "basic") await cache.put(requete, reponse.clone());
      return reponse;
    })
    .catch(() => undefined);
  if (copie) {
    evenement.waitUntil(frais);
    return copie;
  }
  const reponse = await frais;
  if (!reponse) throw new TypeError("hors ligne");
  return reponse;
}

async function ressourceStatique(requete) {
  const cache = await caches.open(CACHE_STATIQUE);
  const copie = await cache.match(requete);
  if (copie) return copie;
  const reponse = await fetch(requete);
  if (reponse.ok && reponse.type === "basic") await cache.put(requete, reponse.clone());
  return reponse;
}

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (requete.method !== "GET") return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (requete.mode === "navigate" && PAGE_DE_SCAN.test(url.pathname)) {
    evenement.respondWith(pageDeScan(evenement, requete, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    evenement.respondWith(ressourceStatique(requete));
    return;
  }
  if (url.pathname.startsWith("/logo/")) {
    evenement.respondWith(ressourceRafraichie(evenement, requete));
  }
  // Tout le reste passe tel quel, sans aucun cache.
});
