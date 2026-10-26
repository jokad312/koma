import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { disponibiliteSchema } from "@/modules/catalogue/fiche";
import { DISPONIBILITES, FILTRES_DISPONIBILITE, SEUIL_DERNIERES_PIECES } from "@/modules/catalogue/types";

const RACINE = process.cwd();

describe("seuil « dernières pièces »", () => {
  it("la constante TypeScript reflète la DERNIÈRE définition SQL de seuil_dernieres_pieces() parmi les migrations", () => {
    const dossier = join(RACINE, "supabase/migrations");
    const motif = /create (?:or replace )?function public\.seuil_dernieres_pieces\(\)[\s\S]*?as \$\$\s*select\s+(\d+)\s*\$\$/g;
    let derniere: number | null = null;
    for (const nom of readdirSync(dossier).filter((n) => n.endsWith(".sql")).sort()) {
      for (const m of readFileSync(join(dossier, nom), "utf8").matchAll(motif)) derniere = Number(m[1]);
    }
    expect(derniere).not.toBeNull();
    expect(derniere).toBe(SEUIL_DERNIERES_PIECES);
    expect(SEUIL_DERNIERES_PIECES).toBe(3);
  });
});

describe("états de disponibilité publics", () => {
  it("cinq états, aucun ne porte de quantité", () => {
    expect([...DISPONIBILITES]).toEqual(["disponible", "dernieres_pieces", "sur_commande", "complet", "epuise"]);
  });

  it("le filtre d'adresse reste en_stock et sur_commande", () => {
    expect([...FILTRES_DISPONIBILITE]).toEqual(["en_stock", "sur_commande"]);
  });

  it("JSON-LD : InStock pour disponible et dernieres_pieces, OutOfStock pour complet et epuise", () => {
    const t = (etat: (typeof DISPONIBILITES)[number]) => [{ taille: "M" as const, etat, delaiJours: null }];
    expect(disponibiliteSchema(t("disponible"))).toBe("https://schema.org/InStock");
    expect(disponibiliteSchema(t("dernieres_pieces"))).toBe("https://schema.org/InStock");
    expect(disponibiliteSchema(t("sur_commande"))).toBe("https://schema.org/MadeToOrder");
    expect(disponibiliteSchema(t("complet"))).toBe("https://schema.org/OutOfStock");
    expect(disponibiliteSchema(t("epuise"))).toBe("https://schema.org/OutOfStock");
  });
});

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : [];
  });
}

describe("aucune lecture publique du stock exact", () => {
  it("aucun code de src n'appelle stock_disponible (réservée au service_role et à la base)", () => {
    const fautifs = fichiers(join(RACINE, "src"))
      .filter((f) => !f.endsWith(join("lib", "supabase", "types.ts")))
      .filter((f) => readFileSync(f, "utf8").includes("stock_disponible"));
    expect(fautifs).toEqual([]);
  });

  it("garde statique : tout accès à la table variante dans src passe par le client service, jamais par un client public, de session ou navigateur", () => {
    const CLIENTS_INTERDITS = /creerClientPublic|creerClientSession|createBrowserClient|createServerClient|createClient\(/;
    const acces = /\.from\(\s*["'`]variante["'`]\s*\)|variante\s*(?:!inner)?\s*\(/g;
    const fautifs: string[] = [];
    const trouves: string[] = [];
    for (const f of fichiers(join(RACINE, "src"))) {
      if (f.endsWith(join("lib", "supabase", "types.ts"))) continue;
      const code = readFileSync(f, "utf8");
      for (const m of code.matchAll(acces)) {
        // Fonction englobante : de la dernière déclaration de fonction avant l'accès jusqu'à la suivante.
        const debut = Math.max(code.lastIndexOf("\nexport ", m.index), code.lastIndexOf("\nasync function", m.index), code.lastIndexOf("\nfunction", m.index), 0);
        const suite = code.slice(m.index + 1).search(/\n(?:export |async function|function )/);
        const corps = code.slice(debut, suite < 0 ? code.length : m.index + 1 + suite);
        trouves.push(f);
        if (!corps.includes("creerClientService()") || CLIENTS_INTERDITS.test(corps)) fautifs.push(`${f} : ${m[0]}`);
        // Jamais de sélection « * » sur variante.
        const apres = code.slice(m.index, m.index + 80);
        if (/variante\s*\(\s*\*/.test(apres) || /^\.from\(\s*["'`]variante["'`]\s*\)\s*\.select\(\s*(["'`]\*["'`])?\s*\)/.test(apres)) fautifs.push(`${f} : select * sur variante`);
      }
    }
    expect(trouves.length).toBeGreaterThan(0);
    expect(fautifs).toEqual([]);
  });
});
