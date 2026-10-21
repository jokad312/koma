import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3100" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } } }],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    // L'accueil lit le réglage nom_site : le serveur lit la base de .env.local (koma-dev) ou des variables déjà définies.
    // Seule l'adresse du site est fixée ici, pour que canonique et hreflang correspondent au port de test.
    env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3100" },
    reuseExistingServer: !process.env.CI,
  },
});
