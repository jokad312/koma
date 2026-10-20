// Tests SQL : exécutés dans GitHub Actions (Docker y est disponible).
// En local, le développement se fait sur koma-dev en ligne, sans Docker : le script l'explique et sort sans erreur.
import { spawnSync } from "node:child_process";

const docker = spawnSync("docker", ["info"], { stdio: "ignore", shell: true }).status === 0;

if (!docker) {
  if (process.env.CI) {
    console.error("Docker est indisponible dans la CI : les tests SQL ne peuvent pas tourner.");
    process.exit(1);
  }
  console.log(
    "test:sql ignoré : Docker n'est pas disponible sur ce poste. Les tests SQL tournent dans GitHub Actions (supabase start dans le job CI).",
  );
  process.exit(0);
}

process.exit(spawnSync("npx", ["supabase", "test", "db"], { stdio: "inherit", shell: true }).status ?? 1);
