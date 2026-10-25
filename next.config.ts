import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { photosAutorisees } from "./src/lib/supabase/images-distantes";
import { entetesSecurite } from "./src/lib/securite/entetes";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: { remotePatterns: photosAutorisees(process.env.NEXT_PUBLIC_SUPABASE_URL) },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: entetesSecurite({
          adresseSite: process.env.NEXT_PUBLIC_SITE_URL,
          adresseSupabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
          production: process.env.NODE_ENV === "production",
        }),
      },
    ];
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
