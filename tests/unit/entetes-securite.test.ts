import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { entetesSecurite, politiqueContenu } from "@/lib/securite/entetes";

const valeur = (entetes: { key: string; value: string }[], nom: string) => entetes.find((e) => e.key === nom)?.value;

describe("en-têtes de sécurité", () => {
  const dev = entetesSecurite({ adresseSite: "http://localhost:3000", adresseSupabase: "http://127.0.0.1:54321", production: false });
  const prod = entetesSecurite({ adresseSite: "https://exemple.test", adresseSupabase: "https://projet.supabase.co", production: true });

  it("pose nosniff, la politique de référent, DENY et les permissions", () => {
    for (const entetes of [dev, prod]) {
      expect(valeur(entetes, "X-Content-Type-Options")).toBe("nosniff");
      expect(valeur(entetes, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(valeur(entetes, "X-Frame-Options")).toBe("DENY");
      expect(valeur(entetes, "Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    }
  });

  it("pose la CSP en Report-Only seulement, jamais en mode bloquant", () => {
    for (const entetes of [dev, prod]) {
      expect(valeur(entetes, "Content-Security-Policy-Report-Only")).toContain("default-src 'self'");
      expect(valeur(entetes, "Content-Security-Policy")).toBeUndefined();
    }
  });

  it("laisse passer le script du thème (inline) et le projet Supabase, sans eval en production", () => {
    const csp = politiqueContenu({ adresseSupabase: "https://projet.supabase.co", production: true });
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("connect-src 'self' https://projet.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(politiqueContenu({ production: false })).toContain("'unsafe-eval'");
  });

  it("active HSTS seulement en production sur une adresse https", () => {
    expect(valeur(prod, "Strict-Transport-Security")).toBe("max-age=31536000");
    expect(valeur(dev, "Strict-Transport-Security")).toBeUndefined();
    expect(valeur(entetesSecurite({ adresseSite: "http://localhost:3000", production: true }), "Strict-Transport-Security")).toBeUndefined();
  });

  it("est branché sur toutes les routes par next.config", async () => {
    const regles = await nextConfig.headers?.();
    expect(regles).toHaveLength(1);
    expect(regles?.[0].source).toBe("/:path*");
    expect(regles?.[0].headers.map((e) => e.key)).toEqual(expect.arrayContaining(["X-Frame-Options", "Content-Security-Policy-Report-Only"]));
  });

  it("autorise seulement le CDN de la vidéo du héros comme média externe, et l'API de Bunny pour l'envoi", () => {
    const csp = politiqueContenu({ adresseSupabase: "https://projet.supabase.co", hoteVideoPublic: "vz-test.b-cdn.net", production: true });
    expect(csp).toContain("media-src 'self' https://vz-test.b-cdn.net");
    expect(csp).toContain("https://video.bunnycdn.com");
    expect(politiqueContenu({ production: true })).toContain("media-src 'self';");
  });
});
