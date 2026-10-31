export type EnteteHttp = { key: string; value: string };

type Options = {
  adresseSite?: string;
  adresseSupabase?: string;
  // Nom d'hôte du CDN de la bibliothèque Bunny publique (vidéo du héros) : seule source de média externe.
  hoteVideoPublic?: string | null;
  production: boolean;
};

// CSP en mode Report-Only (story 1.4) : elle ne bloque rien, elle laisse le navigateur signaler. 'unsafe-inline' couvre le script
// du thème et les scripts de Next ; la story 9.9 passe en mode strict (nonce si nécessaire).
export function politiqueContenu({ adresseSupabase, hoteVideoPublic, production }: Pick<Options, "adresseSupabase" | "hoteVideoPublic" | "production">): string {
  const cdnPublic = hoteVideoPublic ? `https://${hoteVideoPublic}` : null;
  // L'envoi TUS de la vidéo du héros part du navigateur vers l'API de Bunny (admin seulement). L'extrait d'un Kit (story 3.3) est lu en HLS
  // par hls.js : playlist, segments et sous-titres sont chargés depuis le CDN public, puis joués depuis une source blob:.
  const connexions = ["'self'", adresseSupabase, "https://video.bunnycdn.com", cdnPublic].filter(Boolean).join(" ");
  const medias = ["'self'", "blob:", cdnPublic].filter(Boolean).join(" ");
  // Affiche de l'extrait (thumbnail.jpg du CDN public).
  const images = ["'self'", "data:", "blob:", cdnPublic].filter(Boolean).join(" ");
  const scripts = ["'self'", "'unsafe-inline'", production ? null : "'unsafe-eval'"].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images}`,
    `media-src ${medias}`,
    "font-src 'self' data:",
    `connect-src ${connexions}`,
    // hls.js transcode les segments dans un worker créé depuis une source blob:.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Caméra, micro et géolocalisation désactivés ; la caméra sera réouverte pour le scan des Pass (epic 7).
const PERMISSIONS = "camera=(), microphone=(), geolocation=()";

// HSTS seulement en production et sur une adresse https : jamais sur http://localhost.
export function entetesSecurite({ adresseSite, adresseSupabase, hoteVideoPublic, production }: Options): EnteteHttp[] {
  const entetes: EnteteHttp[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: PERMISSIONS },
    { key: "Content-Security-Policy-Report-Only", value: politiqueContenu({ adresseSupabase, hoteVideoPublic, production }) },
  ];
  if (production && adresseSite?.startsWith("https://")) {
    entetes.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
  }
  return entetes;
}
