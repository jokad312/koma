import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3100" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } } }],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    // Valeurs de test seulement : la page d'accueil ne contacte pas la base.
    env: {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "TEST_cle_publique",
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "TEST_cle_secrete",
    },
    reuseExistingServer: !process.env.CI,
  },
});
