import { describe, expect, it } from "vitest";
import { detecterNavigateurIntegre } from "@/lib/navigateur-integre";

// Agents utilisateurs relevés dans ces applications (versions variées). WhatsApp n'a pas d'agent de navigation propre connu :
// l'exemple est son agent HTTP ; le cas réel est à confirmer sur téléphone (test manuel de la story).
const INTEGRES = {
  "Instagram Android": ["Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36 Instagram 315.0.0.29.109 Android (33/13; 450dpi; 1080x2159; samsung; SM-A135F; a13; exynos850; fr_FR; 560180679)", "instagram", "android"],
  "Instagram iPhone": ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21C62 Instagram 315.1.2.30.114 (iPhone14,5; iOS 17_2; fr_FR; fr-FR; scale=3.00; 1170x2532; 560280631)", "instagram", "ios"],
  "Facebook Android": ["Mozilla/5.0 (Linux; Android 12; TECNO KG5k Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/443.0.0.46.105;]", "facebook", "android"],
  "Facebook iPhone": ["Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20G75 [FBAN/FBIOS;FBAV/440.0.0.30.109;FBBV/564232356;FBDV/iPhone12,1;FBMD/iPhone;FBSN/iOS;FBSV/16.6;FBSS/2;FBID/phone;FBLC/fr_FR;FBOP/5]", "facebook", "ios"],
  "Messenger Android": ["Mozilla/5.0 (Linux; Android 11; Infinix X6816 Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36 Orca-Android/440.0.0.30.109;FBAV/440.0.0.30.109;", "facebook", "android"],
  "TikTok Android": ["Mozilla/5.0 (Linux; Android 10; TECNO KE5 Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.5615.136 Mobile Safari/537.36 BytedanceWebview/d8a21c6", "tiktok", "android"],
  "TikTok iPhone": ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_32.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/fr Region/FR", "tiktok", "ios"],
  WhatsApp: ["WhatsApp/2.23.20.0 A", "whatsapp", "autre"],
} as const;

const NORMAUX = {
  "Chrome Android": "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36",
  "Safari iPhone": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Chrome ordinateur": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Firefox ordinateur": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Samsung Internet": "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
};

describe("detecterNavigateurIntegre", () => {
  it.each(Object.entries(INTEGRES))("%s est détecté", (_nom, [agent, application, plateforme]) => {
    expect(detecterNavigateurIntegre(agent)).toEqual({ integre: true, application, plateforme });
  });

  it.each(Object.entries(NORMAUX))("%s n'est pas un navigateur intégré", (_nom, agent) => {
    expect(detecterNavigateurIntegre(agent)).toEqual({ integre: false });
  });

  it("agent absent ou vide : pas intégré", () => {
    expect(detecterNavigateurIntegre(null)).toEqual({ integre: false });
    expect(detecterNavigateurIntegre(undefined)).toEqual({ integre: false });
    expect(detecterNavigateurIntegre("")).toEqual({ integre: false });
  });
});
