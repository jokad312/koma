// Génère src/lib/supabase/types.ts depuis le projet lié (koma-dev), sans Docker.
// Le fichier n'est remplacé que si la génération réussit.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const r = spawnSync("npx", ["supabase", "gen", "types", "typescript", "--linked"], { encoding: "utf8", shell: true });
if (r.status !== 0 || !r.stdout.trim()) {
  console.error("Échec : projet non lié ? Lance d'abord `npx supabase login` puis `npm run db:link`.\n" + (r.stderr ?? ""));
  process.exit(1);
}
writeFileSync("src/lib/supabase/types.ts", r.stdout);
console.log("src/lib/supabase/types.ts mis à jour depuis le projet lié.");
