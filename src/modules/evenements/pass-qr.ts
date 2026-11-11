import qrcode from "qrcode-generator";

// Code QR d'un Pass (story 7.5, UX-DR40). Le Code QR encode une charge qui contient le jeton secret du Pass (192 bits aléatoires), jamais
// l'identifiant du Pass seul. La charge n'est pas une adresse : un appareil photo qui la lit n'ouvre rien, et le site n'y est pas nommé.
// Le scan (story 7.6) relit le jeton avec extraireJeton.
export const PREFIXE_CHARGE_QR = "KOMA:PASS:";
// Zone de silence autour du Code QR, en modules (UX-DR40 : 4 modules, sur fond blanc pur).
export const ZONE_SILENCE_MODULES = 4;

const MOTIF_JETON = /^[0-9a-f]{48}$/;

export function jetonValide(jeton: string): boolean {
  return MOTIF_JETON.test(jeton);
}

export function chargeQr(jeton: string): string {
  if (!jetonValide(jeton)) throw new Error("Jeton de Pass invalide.");
  return `${PREFIXE_CHARGE_QR}${jeton}`;
}

// Lit le jeton d'une charge de Code QR ; null si ce n'est pas un Pass KOMA bien formé.
export function extraireJeton(charge: string): string | null {
  const texte = charge.trim();
  if (!texte.startsWith(PREFIXE_CHARGE_QR)) return null;
  const jeton = texte.slice(PREFIXE_CHARGE_QR.length);
  return jetonValide(jeton) ? jeton : null;
}

// Code QR dessiné : « taille » (en modules, zone de silence comprise) et « chemin » (SVG, une unité par module). Le fond blanc est dessiné par le composant.
export type CodeQr = { taille: number; chemin: string };

function creer(charge: string) {
  // Niveau de correction M : lisible sur un écran rayé ou une impression, sans gonfler le Code QR.
  const qr = qrcode(0, "M");
  qr.addData(charge, "Byte");
  qr.make();
  return qr;
}

export function calculerCodeQr(charge: string): CodeQr {
  const qr = creer(charge);
  const n = qr.getModuleCount();
  const segments: string[] = [];
  for (let ligne = 0; ligne < n; ligne += 1) {
    let colonne = 0;
    while (colonne < n) {
      if (!qr.isDark(ligne, colonne)) {
        colonne += 1;
        continue;
      }
      const debut = colonne;
      while (colonne < n && qr.isDark(ligne, colonne)) colonne += 1;
      segments.push(`M${debut + ZONE_SILENCE_MODULES},${ligne + ZONE_SILENCE_MODULES}h${colonne - debut}v1h-${colonne - debut}z`);
    }
  }
  return { taille: n + 2 * ZONE_SILENCE_MODULES, chemin: segments.join("") };
}

// Image du Code QR pour l'email : GIF noir sur blanc pur, zone de silence de 4 modules comprise, 6 pixels par module (environ 250 px).
export function codeQrEnGif(charge: string, pixelsParModule = 6): Buffer {
  const url = creer(charge).createDataURL(pixelsParModule, ZONE_SILENCE_MODULES * pixelsParModule);
  const prefixe = "data:image/gif;base64,";
  if (!url.startsWith(prefixe)) throw new Error("Image du Code QR illisible.");
  return Buffer.from(url.slice(prefixe.length), "base64");
}
