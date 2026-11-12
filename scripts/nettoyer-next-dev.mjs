// Avant `npm run test:e2e` : supprime le cache de développement `.next/dev`.
// Un cache mélangé avec un `npm run build` fait échouer des centaines de tests (« Unexpected non-whitespace character after JSON »).
// Si un serveur de test tourne déjà sur le port 3100 (Playwright le réutilise hors CI), on ne touche à rien.
import { rmSync } from "node:fs";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT_TEST = 3100;

function portOccupe() {
  return new Promise((resolve) => {
    const s = createConnection({ port: PORT_TEST, host: "127.0.0.1" });
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
  });
}

if (await portOccupe()) {
  console.log(`Un serveur écoute déjà sur le port ${PORT_TEST} : .next/dev conservé.`);
} else {
  rmSync(join(racine, ".next", "dev"), { recursive: true, force: true });
  console.log(".next/dev supprimé avant les tests e2e.");
}
