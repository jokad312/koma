export type EnteteHttp = { key: string; value: string };

type Options = {
  adresseSite?: string;
  adresseSupabase?: string;
  production: boolean;
};

// CSP en mode Report-Only (story 1.4) : elle ne bloque rien, elle laisse le navigateur signaler. 'unsafe-inline' couvre le script
// du thème et les scripts de Next ; la story 9.9 passe en mode strict (nonce si nécessaire).
export function politiqueContenu({ adresseSupabase, production }: Pick<Options, "adresseSupabase" | "production">): string {
  const connexions = ["'self'", adresseSupabase].filter(Boolean).join(" ");
  const scripts = ["'self'", "'unsafe-inline'", production ? null : "'unsafe-eval'"].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connexions}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Caméra, micro et géolocalisation désactivés ; la caméra sera réouverte pour le scan des Pass (epic 7).
const PERMISSIONS = "camera=(), microphone=(), geolocation=()";

// HSTS seulement en production et sur une adresse https : jamais sur http://localhost.
export function entetesSecurite({ adresseSite, adresseSupabase, production }: Options): EnteteHttp[] {
  const entetes: EnteteHttp[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: PERMISSIONS },
    { key: "Content-Security-Policy-Report-Only", value: politiqueContenu({ adresseSupabase, production }) },
  ];
  if (production && adresseSite?.startsWith("https://")) {
    entetes.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
  }
  return entetes;
}
