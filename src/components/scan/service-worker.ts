// Enregistrement du service worker du Scan (story 7.8). Appelé UNIQUEMENT par l'écran de Scan : le service worker n'existe donc que sur cette route,
// et sa portée est limitée à /fr/scan ou /en/scan. Le fichier est /sw-scan.js (public/), à la racine : sa portée maximale par défaut est « / », la portée
// demandée ici est plus étroite, aucun en-tête Service-Worker-Allowed n'est nécessaire (et aucun n'élargit la portée).

export const FICHIER_SERVICE_WORKER = "/sw-scan.js";

// Adresse d'enregistrement : l'identifiant du déploiement (inscrit au build) change l'adresse, donc le service worker, donc ses caches, à chaque déploiement.
export function urlServiceWorker(): string {
  return `${FICHIER_SERVICE_WORKER}?v=${encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? "dev")}`;
}

// Efface les copies de la page de Scan (autre Compte sur le même appareil). Les fichiers statiques, communs à tous, restent.
export async function purgerCachePagesScan(cachesApi: Pick<CacheStorage, "keys" | "delete"> | undefined = typeof caches === "undefined" ? undefined : caches): Promise<void> {
  if (!cachesApi) return;
  try {
    for (const nom of await cachesApi.keys()) if (nom.startsWith("koma-scan-") && nom.endsWith("-pages")) await cachesApi.delete(nom);
  } catch {
    // Sans accès au cache, rien à purger.
  }
}

export function porteeScan(locale: string): string | null {
  return locale === "fr" || locale === "en" ? `/${locale}/scan` : null;
}

type NavigateurSw = { serviceWorker?: Pick<ServiceWorkerContainer, "register"> };

// « enregistre » ; « indisponible » (navigateur sans service worker, connexion non sécurisée, développement, langue inconnue) ; « echec ».
export async function enregistrerServiceWorkerScan(
  locale: string,
  options: { navigateur?: NavigateurSw; production?: boolean } = {},
): Promise<"enregistre" | "indisponible" | "echec"> {
  const portee = porteeScan(locale);
  const navigateur = options.navigateur ?? (typeof navigator === "undefined" ? undefined : navigator);
  const production = options.production ?? process.env.NODE_ENV === "production";
  // En développement, le cache des fichiers générés gênerait le rechargement à chaud.
  if (!portee || !production || !navigateur?.serviceWorker) return "indisponible";
  try {
    await navigateur.serviceWorker.register(urlServiceWorker(), { scope: portee, updateViaCache: "none" });
    return "enregistre";
  } catch {
    return "echec";
  }
}
