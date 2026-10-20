import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("règle de lint sur tests/doubles", () => {
  it("interdit à un fichier de src/ d'importer tests/doubles", async () => {
    const eslint = new ESLint();
    const [resultat] = await eslint.lintText('import { x } from "../../tests/doubles/TEST_faux";\nexport const y = x;\n', {
      filePath: "src/lib/exemple.ts",
    });
    expect(resultat.messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });
});
