// Lance un ou plusieurs tests SQL (pgTAP, supabase/tests/*.test.sql) sur le projet lié (koma-dev), sans Docker.
// Usage : `npm run test:sql:linked -- supabase/tests/fusion_panier_quatre_cas.test.sql`.
// Chaque fichier tourne dans UNE transaction annulée à la fin (le fichier commence par begin; et finit par rollback;) : rien n'est écrit,
// pas même l'extension pgTAP, créée dans la transaction. `finish(true)` fait échouer l'appel au premier test raté.
// Réservé au poste de développement : la CI garde `npm run test:sql` (base locale jetable).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fichiers = process.argv.slice(2);
if (fichiers.length === 0) {
  console.error("usage : npm run test:sql:linked -- supabase/tests/<fichier>.test.sql [...]");
  process.exit(2);
}

let echecs = 0;
for (const fichier of fichiers) {
  let sql;
  try {
    sql = readFileSync(fichier, "utf8");
  } catch (e) {
    console.error(`ÉCHEC ${fichier} : lecture impossible (${e instanceof Error ? e.message : e})`);
    echecs += 1;
    continue;
  }
  // Rien ne doit être validé sur koma-dev : begin; est la PREMIÈRE instruction (seuls des commentaires la précèdent), rollback; la dernière,
  // et aucun commit, end ni rollback intermédiaire (un « end; » de bloc PL/pgSQL est refusé aussi : on préfère refuser à tort que valider).
  const sansCommentaires = sql.replace(/--[^\n]*/g, "");
  const garde =
    /^\s*begin\s*;/i.test(sansCommentaires) &&
    /rollback\s*;\s*$/i.test(sansCommentaires) &&
    (sansCommentaires.match(/\b(commit|rollback|end)\s*(transaction|work)?\s*;/gi) ?? []).length === 1 &&
    /select \* from finish\(\);/i.test(sql);
  if (!garde) {
    console.error(`ÉCHEC ${fichier} : refusé. Il faut begin; en première instruction, rollback; en dernière, aucun commit ni end; et « select * from finish(); ».`);
    echecs += 1;
    continue;
  }
  const prepare = sql
    .replace(/^\s*begin;/im, "begin;\ncreate extension if not exists pgtap with schema extensions;")
    .replace(/select \* from finish\(\);/i, "select * from finish(true);");
  const dossier = mkdtempSync(join(tmpdir(), "test-sql-linked-"));
  const chemin = join(dossier, "test.sql");
  writeFileSync(chemin, prepare);
  const r = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", `"${chemin}"`], { encoding: "utf8", shell: true });
  rmSync(dossier, { recursive: true, force: true });
  const sortie = `${r.stdout}\n${r.stderr}`;
  // Échec : sortie non nulle de la CLI, test « not ok », ou erreur SQL (finish(true) lève une erreur au premier test raté).
  const rate = r.status !== 0 || /^\s*"?not ok\b/m.test(sortie) || /\bERROR:|"error"\s*:/.test(sortie);
  console.log(`${rate ? "ÉCHEC" : "OK   "} ${fichier}`);
  if (rate) {
    console.log(sortie.replace(/A new version of Supabase CLI[^\n]*\n?|We recommend updating[^\n]*\n?/g, "").slice(0, 3000));
    echecs += 1;
  }
}
process.exit(echecs > 0 ? 1 : 0);
