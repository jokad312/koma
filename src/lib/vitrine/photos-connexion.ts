import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";

// Photos du panneau de la page de connexion (story 9.16, modèle F) : fichiers image déposés par Jonathan dans public/images/connexion/ (ses propres
// photos seulement, règle 6). Dossier absent, vide ou illisible : liste vide, la page montre alors le visuel de remplacement « COSPLAY ».
const EXTENSIONS = /\.(jpe?g|png|webp|avif)$/i;

// « use cache » : les photos ne changent qu'avec un déploiement (fichiers du dépôt) ; la page de connexion reste pré-rendue (cacheComponents).
export async function lirePhotosConnexion(): Promise<string[]> {
  "use cache";
  try {
    const entrees = await readdir(path.join(process.cwd(), "public", "images", "connexion"), { withFileTypes: true });
    // Fichiers seulement : un sous-dossier nommé « x.jpg » donnerait une image cassée.
    return entrees
      .filter((e) => e.isFile() && EXTENSIONS.test(e.name) && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort()
      .map((f) => `/images/connexion/${encodeURIComponent(f)}`);
  } catch {
    return [];
  }
}
