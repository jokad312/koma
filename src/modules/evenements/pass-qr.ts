import qrcode from "qrcode-generator";

// Code QR d'un Pass (story 7.5, UX-DR40). Le Code QR encode une charge qui contient le jeton secret du Pass (192 bits aléatoires), jamais l'identifiant
// du Pass seul. La charge n'est pas une adresse : un appareil photo qui la lit n'ouvre rien, et le site n'y est pas nommé.
// Le scan (story 7.6) relit le jeton avec extraireJeton, défini dans pass-charge.ts (sans bibliothèque de dessin, donc léger côté navigateur).
import { jetonValide, PREFIXE_CHARGE_QR } from "./pass-charge";

export { extraireJeton, jetonValide, PREFIXE_CHARGE_QR } from "./pass-charge";
// Zone de silence autour du Code QR, en modules (UX-DR40 : 4 modules, sur fond blanc pur).
export const ZONE_SILENCE_MODULES = 4;

export function chargeQr(jeton: string): string {
  if (!jetonValide(jeton)) throw new Error("Jeton de Pass invalide.");
  return `${PREFIXE_CHARGE_QR}${jeton}`;
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
