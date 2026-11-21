import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";

// Images du panneau de la page de connexion (9.16, puis 9.17) : fichiers de public/images/connexion/. L'ordre du fondu est fixé explicitement
// (ORDRE, décision de Jonathan du 2026-11-21 : l'image en couleur d'abord, comme sur sa référence), jamais par le numéro du nom ; un fichier
// absent de ORDRE (photo ajoutée plus tard) passe après, par nom. Depuis le 2026-11-21, 3 images tierces par exception à la règle 6 (docs/licences/images-connexion.md), à remplacer par les photos de
// Jonathan si un ayant droit le demande. Dossier absent, vide ou illisible : liste vide, la page montre alors le visuel de remplacement « COSPLAY ».
const EXTENSIONS = /\.(jpe?g|png|webp|avif)$/i;
const ORDRE = ["3-illustration.webp", "1-illustration.webp", "2-illustration.webp"];

function rang(nom: string) {
  const i = ORDRE.indexOf(nom);
  return i === -1 ? ORDRE.length : i;
}

// « use cache » : les photos ne changent qu'avec un déploiement (fichiers du dépôt) ; la page de connexion reste pré-rendue (cacheComponents).
export async function lirePhotosConnexion(): Promise<string[]> {
  "use cache";
  try {
    const entrees = await readdir(path.join(process.cwd(), "public", "images", "connexion"), { withFileTypes: true });
    // Fichiers seulement : un sous-dossier nommé « x.jpg » donnerait une image cassée.
    return entrees
      .filter((e) => e.isFile() && EXTENSIONS.test(e.name) && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort((a, b) => rang(a) - rang(b) || a.localeCompare(b, undefined, { numeric: true }))
      .map((f) => `/images/connexion/${encodeURIComponent(f)}`);
  } catch {
    return [];
  }
}
