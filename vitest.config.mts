import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    // next-intl importe « next/server » sans extension : Vite doit le traiter lui-même pour le résoudre.
    server: { deps: { inline: ["next-intl"] } },
  },
});
