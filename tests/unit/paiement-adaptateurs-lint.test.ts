import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

async function regles(code: string, filePath: string) {
  const [resultat] = await new ESLint().lintText(code, { filePath });
  return resultat.messages.map((m) => m.ruleId);
}

const ADAPTATEUR = "src/modules/paiement/adaptateurs/exemple.ts";

// Règle de lint de la story 4.5 (AD-5) : un adaptateur de Prestataire ne touche ni à Supabase ni à un module du site.
describe("adaptateurs de paiement : imports interdits", () => {
  it("refuse Supabase, un module du site, un composant et le code serveur de Next", async () => {
    expect(await regles('import { createClient } from "@supabase/supabase-js";\nexport const a = createClient;\n', ADAPTATEUR)).toContain("no-restricted-imports");
    expect(await regles('import { creerClientService } from "@/lib/supabase/service";\nexport const a = creerClientService;\n', ADAPTATEUR)).toContain("no-restricted-imports");
    expect(await regles('import { lireCommande } from "@/modules/commande/queries";\nexport const a = lireCommande;\n', ADAPTATEUR)).toContain("no-restricted-imports");
    expect(await regles('import "server-only";\nexport const a = 1;\n', ADAPTATEUR)).toContain("no-restricted-imports");
  }, 90_000);

  it("refuse aussi les imports relatifs qui sortent de la couche de paiement ou touchent à son service", async () => {
    const ligne = (chemin: string) => "import { x } from " + JSON.stringify(chemin) + ";" + String.fromCharCode(10) + "export const a = x;" + String.fromCharCode(10);
    for (const chemin of ["../../commande/queries", "../../../lib/supabase/service", "../queries", "../dependances", "../service", "../actions"]) {
      expect(await regles(ligne(chemin), ADAPTATEUR), chemin).toContain("no-restricted-imports");
    }
  }, 90_000);

  it("accepte le port et les types de la couche, en import relatif", async () => {
    const code = 'import type { PrestatairePaiement } from "../types";\nexport type A = PrestatairePaiement;\n';
    expect(await regles(code, ADAPTATEUR)).not.toContain("no-restricted-imports");
  });

  it("la règle ne s'applique qu'aux adaptateurs : le service de paiement peut lire la base", async () => {
    const code = 'import { creerClientService } from "@/lib/supabase/service";\nexport const a = creerClientService;\n';
    expect(await regles(code, "src/modules/paiement/exemple.ts")).not.toContain("no-restricted-imports");
  });
});
