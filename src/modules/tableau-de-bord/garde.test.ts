import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Garde de la story 9.8 : le tableau de bord ne lit que les fonctions d'agrégats de la partie 1, les vues de la story 9.7 et les
// compteurs de tâches existants. Jamais une table de Commande, de Compte ou de client, et aucune donnée personnelle.
const RACINE = process.cwd();
const DOSSIERS = [join(RACINE, "src/modules/tableau-de-bord"), join(RACINE, "src/components/admin/tableau")];
const SOURCES = [
  ...DOSSIERS.flatMap((d) => readdirSync(d).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts")).map((f) => join(d, f))),
  join(RACINE, "src/app/[locale]/admin/page.tsx"),
];

const VUES_PERMISES = ["vue_visites_jour", "vue_entonnoir_jour", "vue_ventes_origine", "vue_ventes_code_promo", "vue_deuxiemes_achats", "vue_desinscriptions_jour"];
const FONCTIONS_PERMISES = ["tableau_commandes_payees", "tableau_paiements", "tableau_echecs_paiement", "tableau_delai_mesures", "tableau_trop_percus", "compter_photos_a_traiter"];
// Seuls ces compteurs de tâches existants sont importés ; la page n'en lit que des nombres.
const HELPERS_PERMIS = ["lireTachesAdmin", "compterMessagesNouveaux", "lireMesuresARecevoir", "lireTachesRemboursement"];

// Tout appel .from( ou .rpc( doit porter un littéral entre guillemets doubles : ni apostrophes, ni backticks, ni variable, ni alias.
function appels(texte: string, nom: "from" | "rpc"): { argument: string; litteral: string | null }[] {
  return [...texte.matchAll(new RegExp(`\\.${nom}\\(\\s*([^,)]*)`, "g"))].map((m) => {
    const argument = m[1].trim();
    const litteral = /^"([a-z_]+)"$/.exec(argument);
    return { argument, litteral: litteral ? litteral[1] : null };
  });
}

describe("garde du tableau de bord", () => {
  it("les sources existent, page comprise", () => {
    expect(SOURCES.length).toBeGreaterThan(6);
    expect(SOURCES.some((f) => f.endsWith("page.tsx"))).toBe(true);
  });

  it("seules les vues de la story 9.7 sont lues avec .from(), toujours par un littéral", () => {
    for (const fichier of SOURCES) {
      for (const a of appels(readFileSync(fichier, "utf8"), "from")) {
        expect(a.litteral, `${fichier} : .from(${a.argument}) n'est pas un littéral entre guillemets doubles`).not.toBeNull();
        expect(VUES_PERMISES, `${fichier} lit ${a.litteral}`).toContain(a.litteral);
      }
    }
  });

  it("seules les fonctions d'agrégats permises sont appelées avec .rpc(), toujours par un littéral", () => {
    for (const fichier of SOURCES) {
      for (const a of appels(readFileSync(fichier, "utf8"), "rpc")) {
        expect(a.litteral, `${fichier} : .rpc(${a.argument}) n'est pas un littéral entre guillemets doubles`).not.toBeNull();
        expect(FONCTIONS_PERMISES, `${fichier} appelle ${a.litteral}`).toContain(a.litteral);
      }
    }
  });

  it("aucune colonne de donnée personnelle ni select(\"*\")", () => {
    for (const fichier of SOURCES) {
      const texte = readFileSync(fichier, "utf8");
      expect(texte, fichier).not.toMatch(/select\([^)]*\b(email|telephone|nom|adresse|compte_id|ip)\b/i);
      expect(texte, fichier).not.toMatch(/select\(\s*["'`]\*/);
    }
  });

  it("aucune écriture en base", () => {
    for (const fichier of SOURCES) {
      expect(readFileSync(fichier, "utf8"), fichier).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    }
  });

  it("les compteurs de tâches réutilisés sont limités à une liste fermée", () => {
    const texte = readFileSync(join(RACINE, "src/modules/tableau-de-bord/queries.ts"), "utf8");
    for (const m of texte.matchAll(/import \{([^}]+)\} from "@\/modules\/(?:admin\/queries|commande\/admin-queries)"/g)) {
      for (const nom of m[1].split(",").map((s) => s.trim()).filter(Boolean)) expect(HELPERS_PERMIS, `import de ${nom}`).toContain(nom);
    }
  });
});
