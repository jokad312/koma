import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ORIGINES, PREFERENCES_CREATION } from "@/modules/comptes/schemas";

// Les valeurs permises sont écrites côté Zod et côté SQL (check et fonction) : elles doivent rester identiques.
const SQL = readFileSync("supabase/migrations/20261022140000_ajouter_questions_accueil.sql", "utf8");

function listes(nomColonne: string): string[][] {
  const motif = new RegExp(String.raw`(?<![a-z_])${nomColonne}\s+(?:not\s+)?in \(([^)]*)\)`, "g");
  return [...SQL.matchAll(motif)].map((m) => [...m[1].matchAll(/'([^']+)'/g)].map((v) => v[1]));
}

describe("questions d'accueil : valeurs permises", () => {
  it("origine : Zod, check SQL et fonction SQL listent les mêmes valeurs", () => {
    const sql = [...listes("origine"), ...listes("p_origine")];
    expect(sql).toHaveLength(2);
    for (const liste of sql) expect(liste).toEqual([...ORIGINES]);
  });
  it("préférence : Zod, check SQL et fonction SQL listent les mêmes valeurs", () => {
    const sql = [...listes("preference_creation"), ...listes("p_preference")];
    expect(sql).toHaveLength(2);
    for (const liste of sql) expect(liste).toEqual([...PREFERENCES_CREATION]);
  });
});
