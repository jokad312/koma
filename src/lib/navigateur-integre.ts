// Détection des navigateurs intégrés (Instagram, Facebook, TikTok, WhatsApp, Snapchat, LinkedIn, X, Telegram et vues génériques), côté serveur : seul module qui lit l'agent utilisateur
// pour cette décision. Google bloque sa connexion dans ces vues (« disallowed_useragent »).
export type Application =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "whatsapp"
  | "snapchat"
  | "linkedin"
  | "twitter"
  | "telegram"
  | "webview";
export type Plateforme = "android" | "ios" | "autre";
export type NavigateurIntegre = { integre: false } | { integre: true; application: Application; plateforme: Plateforme };

const MOTIFS: ReadonlyArray<readonly [Application, RegExp]> = [
  ["instagram", /\bInstagram\b/i],
  // FBAN/FBAV : application Facebook ; FB_IAB : vue intégrée Android ; Messenger porte les mêmes marques.
  ["facebook", /\b(?:FBAN|FBAV|FB_IAB|FBIOS|FBSV)\b|\bMessenger(?:Lite)?ForiOS\b|\bOrca-Android\b/i],
  ["tiktok", /\b(?:musical_ly|BytedanceWebview|TikTok)/i],
  ["whatsapp", /\bWhatsApp\b/i],
  ["snapchat", /\bSnapchat\b/i],
  ["linkedin", /\bLinkedInApp\b/i],
  // X porte encore la marque Twitter dans son agent (« Twitter for iPhone », « TwitterAndroid »).
  ["twitter", /\bTwitter/i],
  ["telegram", /\bTelegram/i],
];

// Vues intégrées sans marque d'application (Google les bloque aussi) : WebView Android (« ; wv) ») et WKWebView iOS,
// dont l'agent n'a pas le jeton « Safari/ » que Safari, Chrome, Firefox et Edge pour iOS portent tous.
function estVueGenerique(agent: string): boolean {
  if (/;\s*wv\)/i.test(agent)) return true;
  return /\b(?:iPhone|iPad|iPod)\b/.test(agent) && /\bAppleWebKit\b/.test(agent) && !/\bSafari\//.test(agent);
}

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
  if (estVueGenerique(agent)) return { integre: true, application: "webview", plateforme: lirePlateforme(agent) };
  return { integre: false };
}
