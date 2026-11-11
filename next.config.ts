import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { redirectionsAdresses, reecrituresAdresses } from "./src/i18n/adresses";
import { photosAutorisees } from "./src/lib/supabase/images-distantes";
import { lireHoteCdnPublic } from "./src/lib/bunny/config";
import { entetesSecurite, entetesServiceWorker, SOURCE_HORS_SCAN, SOURCE_SCAN, SOURCE_SERVICE_WORKER } from "./src/lib/securite/entetes";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Identifiant du déploiement, inscrit dans le code du navigateur au build : il change l'adresse d'enregistrement du service worker du Scan (story 7.8).
  env: { NEXT_PUBLIC_BUILD_ID: Date.now().toString(36) },
  partialPrefetching: true,
  images: { remotePatterns: photosAutorisees(process.env.NEXT_PUBLIC_SUPABASE_URL) },
  async headers() {
    const options = {
      adresseSite: process.env.NEXT_PUBLIC_SITE_URL,
      adresseSupabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hoteVideoPublic: lireHoteCdnPublic(),
      production: process.env.NODE_ENV === "production",
    };
    // Deux règles qui ne se recouvrent jamais : tout le site garde la caméra fermée ; la page de Scan seule la rouvre (story 7.6).
    return [
      { source: SOURCE_HORS_SCAN, headers: entetesSecurite(options) },
      { source: SOURCE_SCAN, headers: entetesSecurite({ ...options, scan: true }) },
      // Service worker du Scan (story 7.8) : seul fichier concerné, en plus des en-têtes de la règle « hors Scan ».
      { source: SOURCE_SERVICE_WORKER, headers: entetesServiceWorker() },
    ];
  },
  // Adresses propres à chaque langue (src/i18n/adresses.ts) : l'adresse de l'autre langue redirige (308), l'adresse propre sert le dossier interne.
  async redirects() {
    return redirectionsAdresses();
  },
  async rewrites() {
    return { beforeFiles: reecrituresAdresses(), afterFiles: [], fallback: [] };
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
