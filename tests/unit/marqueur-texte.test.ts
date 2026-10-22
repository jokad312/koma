import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contientMarqueur, ESPACES_PUBLICS, MARQUEUR_TEXTE, trouverMarqueurs } from "@/lib/vitrine/marqueur";

describe("marqueur de texte à fournir", () => {
  it("le marqueur exact est « [Texte à fournir] »", () => {
    expect(MARQUEUR_TEXTE).toBe("[Texte à fournir]");
    expect(contientMarqueur("avant [Texte à fournir] après")).toBe(true);
    expect(contientMarqueur("un vrai texte")).toBe(false);
  });

  it("nomme les clés qui portent le marqueur, dans les seuls espaces demandés", () => {
    const messages = {
      APropos: { portrait: { texte: MARQUEUR_TEXTE }, titre: "Titre" },
      Faq: { questions: { paiement: { question: "Vraie question", reponse: MARQUEUR_TEXTE } } },
      Admin: { reglages: { titre: MARQUEUR_TEXTE } },
    };
    expect(trouverMarqueurs(messages, ["APropos", "Faq"])).toEqual(["APropos.portrait.texte", "Faq.questions.paiement.reponse"]);
    expect(trouverMarqueurs(messages, ["Contact"])).toEqual([]);
  });

  it("les espaces publics contrôlés incluent À propos, FAQ et Contact", () => {
    expect(ESPACES_PUBLICS).toEqual(expect.arrayContaining(["APropos", "Faq", "Contact"]));
  });
});

// Le script est lancé comme par `npm run build` (prebuild) ; il lit un dossier de messages passé en argument.
function dossierMessages(texte: string) {
  const dossier = mkdtempSync(join(tmpdir(), "koma-marqueurs-"));
  mkdirSync(dossier, { recursive: true });
  for (const langue of ["fr", "en"]) writeFileSync(join(dossier, `${langue}.json`), JSON.stringify({ Faq: { questions: { paiement: { reponse: texte } } }, Autre: { x: MARQUEUR_TEXTE } }));
  return dossier;
}

function lancer(dossier: string, variable?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.KOMA_VERIFIER_TEXTES;
  if (variable !== undefined) env.KOMA_VERIFIER_TEXTES = variable;
  return spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/verifier-marqueurs.mjs", dossier], { env, encoding: "utf8" });
}

describe("scripts/verifier-marqueurs.mjs", () => {
  it("avec KOMA_VERIFIER_TEXTES=true et un marqueur : échec qui nomme les clés", () => {
    const r = lancer(dossierMessages(MARQUEUR_TEXTE), "true");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("fr.json : Faq.questions.paiement.reponse");
    expect(r.stderr).toContain("en.json : Faq.questions.paiement.reponse");
    // Un espace non public (« Autre ») n'est pas contrôlé.
    expect(r.stderr).not.toContain("Autre");
  });

  it("avec la variable et sans marqueur : succès", () => {
    expect(lancer(dossierMessages("Un vrai texte."), "true").status).toBe(0);
  });

  it("sans la variable (dev, CI, build local) : succès même avec un marqueur", () => {
    expect(lancer(dossierMessages(MARQUEUR_TEXTE)).status).toBe(0);
    expect(lancer(dossierMessages(MARQUEUR_TEXTE), "false").status).toBe(0);
    expect(lancer(dossierMessages(MARQUEUR_TEXTE), "").status).toBe(0);
  });

  it("« TRUE » et « 1 » activent aussi le contrôle (casse ignorée)", () => {
    for (const v of ["TRUE", "True", "1"]) expect(lancer(dossierMessages(MARQUEUR_TEXTE), v).status, v).toBe(1);
  });

  it("valeur inconnue : avertissement sur stderr, contrôle ignoré ; « false » et « 0 » restent silencieux", () => {
    const r = lancer(dossierMessages(MARQUEUR_TEXTE), "oui");
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("valeur inconnue");
    expect(lancer(dossierMessages(MARQUEUR_TEXTE), "0").stderr).toBe("");
  });

  it("branché sur le build : prebuild lance le script, et la variable n'est pas lue par env.ts", () => {
    const paquet = JSON.parse(readFileSync("package.json", "utf8"));
    expect(paquet.scripts.prebuild).toContain("scripts/verifier-marqueurs.mjs");
    expect(readFileSync("src/lib/env.ts", "utf8")).not.toContain("KOMA_VERIFIER_TEXTES");
    expect(readFileSync(".env.example", "utf8")).toContain("KOMA_VERIFIER_TEXTES=");
  });
});
