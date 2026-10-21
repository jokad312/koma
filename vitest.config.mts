import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Les tests ESLint (règles de lint) sont lents quand plusieurs fichiers tournent en parallèle.
    testTimeout: 30000,
    // Les tests de composants ajoutent « // @vitest-environment jsdom » en tête de fichier ; les autres restent sous Node.
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
    // next-intl importe « next/server » sans extension : Vite doit le traiter lui-même pour le résoudre.
    server: { deps: { inline: ["next-intl"] } },
  },
});
