// Détection des navigateurs intégrés (Instagram, Facebook, TikTok, WhatsApp), côté serveur : seul module qui lit l'agent utilisateur
// pour cette décision. Google bloque sa connexion dans ces vues (« disallowed_useragent »).
export type Application = "instagram" | "facebook" | "tiktok" | "whatsapp";
export type Plateforme = "android" | "ios" | "autre";
export type NavigateurIntegre = { integre: false } | { integre: true; application: Application; plateforme: Plateforme };

const MOTIFS: ReadonlyArray<readonly [Application, RegExp]> = [
  ["instagram", /\bInstagram\b/i],
  // FBAN/FBAV : application Facebook ; FB_IAB : vue intégrée Android ; Messenger porte les mêmes marques.
  ["facebook", /\b(?:FBAN|FBAV|FB_IAB|FBIOS|FBSV)\b|\bMessenger(?:Lite)?ForiOS\b|\bOrca-Android\b/i],
  ["tiktok", /\b(?:musical_ly|BytedanceWebview|TikTok)/i],
  ["whatsapp", /\bWhatsApp\b/i],
];

export function lirePlateforme(agent: string): Plateforme {
  if (/\bAndroid\b/i.test(agent)) return "android";
  if (/\b(?:iPhone|iPad|iPod)\b/i.test(agent)) return "ios";
  return "autre";
}

export function detecterNavigateurIntegre(agent: string | null | undefined): NavigateurIntegre {
  if (!agent) return { integre: false };
  for (const [application, motif] of MOTIFS) {
    if (motif.test(agent)) return { integre: true, application, plateforme: lirePlateforme(agent) };
  }
  return { integre: false };
}
