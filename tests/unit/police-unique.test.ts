import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Story 9.16 a) : une seule police web, KOMA Chikara, sur le site, l'admin, /scan et la connexion.
// Barlow ne reste que pour le filigrane PDF des kits (src/fonts/filigrane/ et son module) ; Sakura Town n'existe plus dans le code.
// La couverture des traductions se vérifie par couverture.txt (écrit par scripts/polices/creer-koma-chikara.py) : aucun décodage woff2 ici.

const RACINE = join(process.cwd(), "src");
const DOSSIER_POLICE = join(RACINE, "fonts", "koma-chikara");
const FILIGRANE = [join("src", "fonts", "filigrane") + sep, join("src", "modules", "bibliotheque", "dependances-telechargement.ts")];
const EMAILS = join("src", "modules", "envois", "modeles") + sep;

function fichiers(dossier: string): string[] {
  const liste: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) liste.push(...fichiers(chemin));
    else if (/\.(ts|tsx|css|mjs|js)$/.test(nom)) liste.push(chemin);
  }
  return liste;
}

const sources = fichiers(RACINE).map((f) => ({ chemin: relative(process.cwd(), f), texte: readFileSync(f, "utf8") }));

function caracteresDesTextes(valeur: unknown, acc: Set<string>): Set<string> {
  if (typeof valeur === "string") for (const c of valeur) acc.add(c);
  else if (Array.isArray(valeur)) valeur.forEach((v) => caracteresDesTextes(v, acc));
  else if (valeur && typeof valeur === "object") Object.values(valeur).forEach((v) => caracteresDesTextes(v, acc));
  return acc;
}

describe("police unique KOMA Chikara", () => {
  it("aucune référence à Barlow hors du filigrane, aucune à Sakura Town", () => {
    const barlow = sources.filter((s) => /barlow/i.test(s.texte) && !FILIGRANE.some((x) => s.chemin.startsWith(x))).map((s) => s.chemin);
    const sakura = sources.filter((s) => /sakura/i.test(s.texte)).map((s) => s.chemin);
    expect(barlow).toEqual([]);
    expect(sakura).toEqual([]);
    expect(readdirSync(join(RACINE, "fonts")).filter((f) => /barlow/i.test(f))).toEqual([]);
  });

  it("src/lib/fonts.ts n'exporte que KOMA Chikara : swap, préchargement, replis réglés (Arial puis Roboto) puis polices système", () => {
    const texte = readFileSync(join(RACINE, "lib", "fonts.ts"), "utf8");
    expect([...texte.matchAll(/export\s+const\s+(\w+)/g)].map((m) => m[1])).toEqual(["komaChikara"]);
    expect(texte).toContain('path: "../fonts/koma-chikara/koma-chikara.woff2"');
    expect(texte).toMatch(/display:\s*"swap"/);
    expect(texte).toMatch(/preload:\s*true/);
    expect(texte).toMatch(/adjustFontFallback:\s*false/);
    expect(texte).toMatch(/fallback:\s*\["KOMA Repli Arial",\s*"KOMA Repli Roboto",\s*"system-ui",\s*"sans-serif"\]/);
  });

  it("globals.css : les deux variables de police pointent sur KOMA Chikara, un seul poids (font-synthesis: none)", () => {
    const globals = readFileSync(join(RACINE, "app", "globals.css"), "utf8");
    expect(globals).toMatch(/--font-corps:\s*var\(--font-koma-chikara\);/);
    expect(globals).toMatch(/--font-condensee:\s*var\(--font-koma-chikara\);/);
    expect(globals).toMatch(/font-synthesis:\s*none/);
  });

  it("globals.css : replis réglés déclarés (Arial et Roboto, texte courant et majuscules), pile des majuscules sur les rôles en capitales", () => {
    const globals = readFileSync(join(RACINE, "app", "globals.css"), "utf8");
    for (const famille of ["KOMA Repli Arial", "KOMA Repli Roboto", "KOMA Repli Arial Capitales", "KOMA Repli Roboto Capitales"]) {
      const bloc = globals.match(new RegExp(String.raw`@font-face \{\s*font-family: "${famille}";[^}]*\}`));
      expect(bloc, famille).not.toBeNull();
      expect(bloc![0]).toMatch(/src: local\("(Arial|Roboto)"\)/);
      for (const r of ["size-adjust", "ascent-override", "descent-override", "line-gap-override"]) expect(bloc![0], `${famille} ${r}`).toContain(r);
    }
    expect(globals).toMatch(/--font-capitales:\s*"komaChikara", "KOMA Repli Arial Capitales", "KOMA Repli Roboto Capitales", system-ui, sans-serif;/);
    // Tout rôle t-* en majuscules prend la pile des majuscules.
    const roles = [...globals.matchAll(/@utility (t-[\w-]+) \{([\s\S]*?)\r?\n\}/g)];
    expect(roles.length).toBeGreaterThan(5);
    for (const [, nom, corps] of roles) {
      if (/text-transform:\s*uppercase/.test(corps)) expect(corps, nom).toContain("font-family: var(--font-capitales);");
    }
  });

  it("aucun poids de police demandé hors emails (un seul poids dessiné)", () => {
    const fautes = sources
      .filter((s) => !s.chemin.startsWith(EMAILS) && !/\.test\.tsx?$/.test(s.chemin))
      .flatMap((s) =>
        s.texte.split(/\r?\n/).flatMap((ligne, i) =>
          /\bfont-(?:thin|extralight|light|medium|semibold|bold|extrabold|black)\b|font-weight\s*:\s*(?!400\b|normal\b)|fontWeight/.test(ligne)
            ? [`${s.chemin}:${i + 1}`]
            : [],
        ),
      );
    expect(fautes).toEqual([]);
  });

  it("fichier de police et licence présents", () => {
    for (const f of ["koma-chikara.woff2", "LICENCE.txt", "couverture.txt"]) expect(existsSync(join(DOSSIER_POLICE, f)), f).toBe(true);
  });

  it("tous les caractères de messages/fr.json et messages/en.json sont dans la police", () => {
    const couverts = new Set(
      readFileSync(join(DOSSIER_POLICE, "couverture.txt"), "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((h) => String.fromCodePoint(parseInt(h, 16))),
    );
    expect(couverts.size).toBeGreaterThan(150);
    for (const langue of ["fr", "en"]) {
      const textes = JSON.parse(readFileSync(join(process.cwd(), "messages", `${langue}.json`), "utf8"));
      const manquants = [...caracteresDesTextes(textes, new Set())].filter((c) => c !== "\n" && !couverts.has(c));
      expect(manquants.map((c) => `${c} U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`), langue).toEqual([]);
    }
  });
});
