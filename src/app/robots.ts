import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { adresseSite } from "@/lib/seo/url";

export default function robots(): MetadataRoute.Robots {
  const exclus = ["/api/", "/auth/", ...routing.locales.flatMap((l) => [`/${l}/admin`, `/${l}/compte`])];
  return {
    rules: { userAgent: "*", allow: "/", disallow: exclus },
    sitemap: `${adresseSite()}/sitemap.xml`,
  };
}
