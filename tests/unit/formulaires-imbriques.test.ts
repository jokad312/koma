import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Garde statique : un <form> dans un <form> est invalide en HTML (React : « <form> cannot be a descendant of <form> »),
// casse l'hydratation et peut envoyer le mauvais formulaire. Deux contrôles sur tout src/ :
//  1. aucun fichier n'ouvre un <form> à l'intérieur d'un autre <form> ;
//  2. aucun composant qui contient un <form> n'est utilisé entre le <form> et le </form> d'un autre fichier.

const RACINE = join(process.cwd(), "src");

function fichiersTsx(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiersTsx(chemin) : chemin.endsWith(".tsx") ? [chemin] : [];
  });
}

// Les commentaires sont retirés : un « <form> » écrit dans un commentaire n'est pas un formulaire.
const sansCommentaires = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
const sources = new Map(fichiersTsx(RACINE).map((f) => [normalize(f), sansCommentaires(readFileSync(f, "utf-8"))]));
const nom = (f: string) => relative(process.cwd(), f).split(sep).join("/");

// Plages [début, fin] de chaque <form …>…</form> d'un fichier ; null si l'imbrication est dans le fichier même.
function plagesForm(src: string): { plages: Array<[number, number]>; imbrique: boolean } {
  const plages: Array<[number, number]> = [];
  const pile: number[] = [];
  let imbrique = false;
  for (const m of src.matchAll(/<form[\s>]|<\/form>/g)) {
    if (m[0].startsWith("</")) {
      const debut = pile.pop();
      if (debut !== undefined) plages.push([debut, m.index]);
    } else {
      if (pile.length > 0) imbrique = true;
      pile.push(m.index);
    }
  }
  return { plages, imbrique };
}

function resoudre(depuis: string, specifieur: string): string | null {
  const base = specifieur.startsWith("@/") ? join(RACINE, specifieur.slice(2)) : specifieur.startsWith(".") ? normalize(join(dirname(depuis), specifieur)) : null;
  if (!base) return null;
  for (const candidat of [`${base}.tsx`, join(base, "index.tsx")]) if (sources.has(normalize(candidat))) return normalize(candidat);
  return null;
}

const AVEC_FORM = new Set([...sources].filter(([, s]) => /<form[\s>]/.test(s)).map(([f]) => f));

describe("aucun formulaire imbriqué", () => {
  it("il existe des formulaires à contrôler (le test ne tourne pas à vide)", () => {
    expect(AVEC_FORM.size).toBeGreaterThan(10);
  });

  it("aucun fichier n'ouvre un <form> dans un <form>", () => {
    const fautifs = [...AVEC_FORM].filter((f) => plagesForm(sources.get(f)!).imbrique).map(nom);
    expect(fautifs).toEqual([]);
  });

  it("aucun composant contenant un <form> n'est utilisé à l'intérieur d'un <form>", () => {
    const fautes: string[] = [];
    for (const [fichier, src] of sources) {
      const { plages } = plagesForm(src);
      if (plages.length === 0) continue;
      for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"|import\s+(\w+)\s+from\s+"([^"]+)"/g)) {
        const cible = resoudre(fichier, m[2] ?? m[4]);
        if (!cible || !AVEC_FORM.has(cible) || cible === fichier) continue;
        const noms = m[1] ? m[1].split(",").map((n) => n.trim().split(/\s+as\s+/).pop()!).filter(Boolean) : [m[3]];
        for (const n of noms) {
          for (const u of src.matchAll(new RegExp(`<${n}[\\s/>]`, "g"))) {
            if (plages.some(([a, b]) => u.index > a && u.index < b)) fautes.push(`${nom(fichier)} : <${n}> dans un <form> (${nom(cible)} contient aussi un <form>)`);
          }
        }
      }
    }
    expect(fautes).toEqual([]);
  });
});
