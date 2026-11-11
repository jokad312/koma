export type EnteteHttp = { key: string; value: string };

type Options = {
  // Écran de Scan (story 7.6) : seul endroit du site où la caméra est ouverte et où le module WebAssembly du lecteur de Code QR est compilé.
  scan?: boolean;
  adresseSite?: string;
  adresseSupabase?: string;
  // Nom d'hôte du CDN de la bibliothèque Bunny publique (vidéo du héros) : seule source de média externe.
  hoteVideoPublic?: string | null;
  production: boolean;
};

// CSP en mode Report-Only (story 1.4) : elle ne bloque rien, elle laisse le navigateur signaler. 'unsafe-inline' couvre le script
// du thème et les scripts de Next ; la story 9.9 passe en mode strict (nonce si nécessaire).
export function politiqueContenu({ adresseSupabase, hoteVideoPublic, production, scan = false }: Pick<Options, "adresseSupabase" | "hoteVideoPublic" | "production" | "scan">): string {
  const cdnPublic = hoteVideoPublic ? `https://${hoteVideoPublic}` : null;
  // L'envoi TUS de la vidéo du héros part du navigateur vers l'API de Bunny (admin seulement). L'extrait d'un Kit (story 3.3) est lu en HLS
  // par hls.js : playlist, segments et sous-titres sont chargés depuis le CDN public, puis joués depuis une source blob:.
  const connexions = ["'self'", adresseSupabase, "https://video.bunnycdn.com", cdnPublic].filter(Boolean).join(" ");
  const medias = ["'self'", "blob:", cdnPublic].filter(Boolean).join(" ");
  // Affiche de l'extrait (thumbnail.jpg du CDN public).
  const images = ["'self'", "data:", "blob:", cdnPublic].filter(Boolean).join(" ");
  // 'wasm-unsafe-eval' : compilation du lecteur de Code QR (WebAssembly, servi par le site lui-même) ; réservé à la page de Scan.
  const scripts = ["'self'", "'unsafe-inline'", scan ? "'wasm-unsafe-eval'" : null, production ? null : "'unsafe-eval'"].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images}`,
    `media-src ${medias}`,
    "font-src 'self' data:",
    `connect-src ${connexions}`,
    // hls.js transcode les segments dans un worker créé depuis une source blob:. Sur la page de Scan (story 7.8), seul le service worker du site lui-même
    // (/sw-scan.js) est permis : ni blob:, ni origine tierce.
    scan ? "worker-src 'self'" : "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Caméra, micro et géolocalisation désactivés. La caméra n'est rouverte, pour l'origine du site seulement, que sur la page de Scan (story 7.6).
const PERMISSIONS = "camera=(), microphone=(), geolocation=()";
const PERMISSIONS_SCAN = "camera=(self), microphone=(), geolocation=()";

// Source Next.js de toutes les routes SAUF le Scan : expression régulière sur le chemin entier.
export const SOURCE_HORS_SCAN = "/:chemin((?!(?:fr|en)/scan(?:/|$)).*)";
// La page de Scan et tout ce qui est dessous (/fr/scan, /fr/scan/, /fr/scan/x) : exactement le complément de SOURCE_HORS_SCAN.
export const SOURCE_SCAN = "/:langue(fr|en)/scan/:reste*";

// Fichier du service worker du Scan (story 7.8, public/sw-scan.js) : jamais gardé par le cache HTTP, pour que chaque contrôle de mise à jour lise la version
// publiée. Aucun en-tête Service-Worker-Allowed : la portée demandée (/fr/scan, /en/scan) est plus étroite que le dossier du fichier, rien n'est élargi.
export const SOURCE_SERVICE_WORKER = "/sw-scan.js";
export function entetesServiceWorker(): EnteteHttp[] {
  return [
    { key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" },
    { key: "Content-Type", value: "text/javascript; charset=utf-8" },
  ];
}

// HSTS seulement en production et sur une adresse https : jamais sur http://localhost.
export function entetesSecurite({ adresseSite, adresseSupabase, hoteVideoPublic, production, scan = false }: Options): EnteteHttp[] {
  const entetes: EnteteHttp[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: scan ? PERMISSIONS_SCAN : PERMISSIONS },
    { key: "Content-Security-Policy-Report-Only", value: politiqueContenu({ adresseSupabase, hoteVideoPublic, production, scan }) },
  ];
  if (production && adresseSite?.startsWith("https://")) {
    entetes.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
  }
  return entetes;
}
