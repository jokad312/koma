import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Story 9.16 a) : aucun texte sous 16 px, ni sur le site ni dans l'admin (KOMA Chikara, décision de Jonathan du 2026-11-15).
// Lit toutes les feuilles src/**/*.css (dont globals.css) et tous les .ts/.tsx de src/ : une taille écrite en dur sous 16 px
// (px, rem et em rapportés à 16 px), une classe Tailwind text-xs, text-sm ou text-[N] avec N < 16 px, ou un style fontSize
// sous 16 fait échouer le test, avec le fichier et la ligne.
// Hors champ : les emails (src/modules/envois/modeles/ : polices et tailles du client mail) et le filigrane PDF des kits.

const RACINE = join(process.cwd(), "src");
const EXCLUS = [join("src", "modules", "envois", "modeles") + sep, join("src", "fonts", "filigrane") + sep];
const MINIMUM = 16;

function fichiers(dossier: string, extensions: readonly string[]): string[] {
  const liste: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) liste.push(...fichiers(chemin, extensions));
    else if (extensions.some((e) => nom.endsWith(e))) liste.push(chemin);
  }
  return liste.filter((f) => !EXCLUS.some((x) => relative(process.cwd(), f).startsWith(x)));
}

// Taille en px d'une mesure CSS (px, rem, em : 1 rem = 1 em = 16 px), ou null pour une mesure relative à l'écran (vw, %).
export function enPixels(valeur: number, unite: string): number | null {
  if (unite === "px") return valeur;
  if (unite === "rem" || unite === "em") return valeur * 16;
  return null;
}

// Mesures d'une valeur de font-size (clamp, min, max, calc compris) : toutes celles en px, rem ou em doivent valoir 16 px au moins.
export function taillesTropPetites(valeurCss: string): string[] {
  const fautes: string[] = [];
  for (const m of valeurCss.matchAll(/(\d*\.?\d+)(px|rem|em)\b/g)) {
    const px = enPixels(Number(m[1]), m[2]);
    if (px !== null && px < MINIMUM) fautes.push(m[0]);
  }
  return fautes;
}

// Fautes d'une ligne de CSS : font-size et raccourci font.
export function fautesCss(ligne: string): string[] {
  const fautes: string[] = [];
  const taille = ligne.match(/font-size\s*:\s*([^;}]+)/);
  if (taille) fautes.push(...taillesTropPetites(taille[1]));
  // Raccourci « font: 14px/1.4 … » : la taille est la première mesure avant « / » ou la famille.
  const raccourci = ligne.match(/(?:^|[\s;{])font\s*:\s*([^;}]+)/);
  if (raccourci) {
    const premiere = raccourci[1].match(/(\d*\.?\d+)(px|rem|em)\b/);
    if (premiere) fautes.push(...taillesTropPetites(premiere[0]));
  }
  return fautes;
}

// Fautes d'une ligne de .ts/.tsx : classes Tailwind (avec ou sans variante, ex. « md:text-sm ») et style fontSize.
export function fautesComposant(ligne: string): string[] {
  const fautes: string[] = [];
  for (const m of ligne.matchAll(/(?:^|[\s"'`:])(text-(?:xs|sm))(?=[\s"'`]|$)/g)) fautes.push(m[1]);
  for (const m of ligne.matchAll(/text-\[(\d*\.?\d+)(px|rem|em)\]/g)) {
    const px = enPixels(Number(m[1]), m[2]);
    if (px !== null && px < MINIMUM) fautes.push(m[0]);
  }
  for (const m of ligne.matchAll(/fontSize\s*:\s*["'`]?(\d*\.?\d+)(px|rem|em)?/g)) {
    const px = enPixels(Number(m[1]), m[2] ?? "px");
    if (px !== null && px < MINIMUM) fautes.push(m[0]);
  }
  return fautes;
}

function relever(liste: string[], detecteur: (ligne: string) => string[]): string[] {
  const fautes: string[] = [];
  for (const f of liste) {
    readFileSync(f, "utf8")
      .split(/\r?\n/)
      .forEach((ligne, i) => {
        for (const faute of detecteur(ligne)) fautes.push(`${relative(process.cwd(), f)}:${i + 1} : ${faute}`);
      });
  }
  return fautes;
}

describe("détecteurs de taille (le test échoue bien si l'on réintroduit une petite taille)", () => {
  it("CSS : 14px, 0.875rem, 0.8em et clamp(12px, …) sont refusés ; 16px, 1rem, clamp(2.5rem, 11vw, 58px) passent", () => {
    expect(fautesCss("  font-size: 14px;")).toEqual(["14px"]);
    expect(fautesCss("font-size: 0.875rem;")).toEqual(["0.875rem"]);
    expect(fautesCss("font-size:.8em")).toEqual([".8em"]);
    expect(fautesCss("font-size: clamp(12px, 3vw, 20px);")).toEqual(["12px"]);
    expect(fautesCss("font: 13px/1.4 var(--font-corps);")).toEqual(["13px"]);
    expect(fautesCss("font-size: 16px;")).toEqual([]);
    expect(fautesCss("font-size: 1rem;")).toEqual([]);
    expect(fautesCss("font-size: clamp(2.5rem, 11vw, 58px);")).toEqual([]);
    expect(fautesCss("letter-spacing: 0.14em;")).toEqual([]);
  });

  it("composants : text-xs, md:text-sm, text-[14px], text-[0.8rem], fontSize: 12 sont refusés ; text-base, text-[18px] passent", () => {
    expect(fautesComposant('className="t-body text-xs"')).toEqual(["text-xs"]);
    expect(fautesComposant('className="md:text-sm"')).toEqual(["text-sm"]);
    expect(fautesComposant('className="text-[14px]"')).toEqual(["text-[14px]"]);
    expect(fautesComposant('className="text-[0.8rem]"')).toEqual(["text-[0.8rem]"]);
    expect(fautesComposant("style={{ fontSize: 12 }}")).toEqual(["fontSize: 12"]);
    expect(fautesComposant('style={{ fontSize: "14px" }}')).toEqual(['fontSize: "14px']);
    expect(fautesComposant('className="text-base text-[18px] text-text-primary text-small-caps"')).toEqual([]);
  });
});

describe("aucun texte sous 16 px dans src/", () => {
  it("feuilles CSS (globals.css et feuilles des composants)", () => {
    const feuilles = fichiers(RACINE, [".css"]);
    expect(feuilles.some((f) => f.endsWith("globals.css"))).toBe(true);
    expect(relever(feuilles, fautesCss)).toEqual([]);
  });

  it("composants et modules (.ts, .tsx), hors emails et filigrane", () => {
    const sources = fichiers(RACINE, [".ts", ".tsx"]).filter((f) => !/\.test\.tsx?$/.test(f));
    expect(sources.length).toBeGreaterThan(100);
    expect(relever(sources, fautesComposant)).toEqual([]);
  });

  it("rôles typographiques t-small et t-label : 16 px", () => {
    const globals = readFileSync(join(RACINE, "app", "globals.css"), "utf8");
    for (const role of ["t-small", "t-label"]) {
      const bloc = globals.match(new RegExp(`@utility ${role} \\{([^}]+)\\}`));
      expect(bloc?.[1], role).toMatch(/font-size:\s*16px/);
    }
  });
});
