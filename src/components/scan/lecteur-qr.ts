import type { BarcodeDetector as DetecteurNatif } from "barcode-detector/ponyfill";

// Lecture du Code QR dans le navigateur (story 7.6) : l'API native BarcodeDetector quand le navigateur la propose et lit les Codes QR, sinon la
// bibliothèque « barcode-detector » (MIT, version figée ; docs/licences/barcode-detector.md), qui lit avec un module WebAssembly (zxing-wasm).
// Le module WebAssembly est servi par le site lui-même (aucun CDN tiers) : le bundler le publie sous /_next/static/media.
export type DetecteurQr = { source: "natif" | "bibliotheque"; lire: (video: HTMLVideoElement) => Promise<string | null> };

type ClasseDetecteur = typeof DetecteurNatif;

async function natifQr(): Promise<ClasseDetecteur | null> {
  const classe = (globalThis as { BarcodeDetector?: ClasseDetecteur }).BarcodeDetector;
  if (!classe) return null;
  try {
    const formats = await classe.getSupportedFormats();
    return formats.includes("qr_code") ? classe : null;
  } catch {
    return null;
  }
}

export async function creerDetecteurQr(): Promise<DetecteurQr> {
  const natif = await natifQr();
  if (natif) {
    const detecteur = new natif({ formats: ["qr_code"] });
    return { source: "natif", lire: async (video) => (await detecteur.detect(video))[0]?.rawValue ?? null };
  }
  const { BarcodeDetector, setZXingModuleOverrides } = await import("barcode-detector/ponyfill");
  const wasm = new URL("../../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", import.meta.url).href;
  setZXingModuleOverrides({ locateFile: (chemin: string, prefixe: string) => (chemin.endsWith(".wasm") ? wasm : prefixe + chemin) });
  const detecteur = new BarcodeDetector({ formats: ["qr_code"] });
  return { source: "bibliotheque", lire: async (video) => (await detecteur.detect(video))[0]?.rawValue ?? null };
}
