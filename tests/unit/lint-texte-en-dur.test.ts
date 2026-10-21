import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

async function regles(code: string) {
  const [resultat] = await new ESLint().lintText(code, { filePath: "src/components/exemple.tsx" });
  return resultat.messages.map((m) => m.ruleId);
}

describe("texte en dur dans les props (point reporté de la 1.2)", () => {
  it("refuse alt, aria-label, title et placeholder écrits en dur", async () => {
    expect(await regles('export const A = () => <img alt="x" src="/a.png" />;\n')).toContain("no-restricted-syntax");
    expect(await regles('export const A = () => <button aria-label="Fermer" type="button" />;\n')).toContain("no-restricted-syntax");
    expect(await regles('export const A = () => <a title="Aide" href="/a" />;\n')).toContain("no-restricted-syntax");
    expect(await regles('export const A = () => <input placeholder="Nom" />;\n')).toContain("no-restricted-syntax");
    expect(await regles('export const A = () => <img alt={"x"} src="/a.png" />;\n')).toContain("no-restricted-syntax");
  });

  it("accepte un texte venu des traductions et alt vide (image décorative)", async () => {
    const code = 'export const A = ({ t }: { t: (k: string) => string }) => (<><img alt={t("a")} src="/a.png" /><img alt="" src="/b.png" /></>);\n';
    expect(await regles(code)).not.toContain("no-restricted-syntax");
  });
});
