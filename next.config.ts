import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { redirectionsAdresses, reecrituresAdresses } from "./src/i18n/adresses";
import { photosAutorisees } from "./src/lib/supabase/images-distantes";
import { lireHoteCdnPublic } from "./src/lib/bunny/config";
import { entetesSecurite, SOURCE_HORS_SCAN, SOURCE_SCAN } from "./src/lib/securite/entetes";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
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
