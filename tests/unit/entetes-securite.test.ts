import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { entetesSecurite, politiqueContenu, SOURCE_HORS_SCAN, SOURCE_SCAN } from "@/lib/securite/entetes";

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

  it("est branché par next.config : le site entier hors Scan d'un côté, le Scan seul de l'autre", async () => {
    const regles = await nextConfig.headers?.();
    expect(regles).toHaveLength(2);
    expect(regles?.[0].source).toBe(SOURCE_HORS_SCAN);
    expect(regles?.[1].source).toBe(SOURCE_SCAN);
    for (const regle of regles ?? []) expect(regle.headers.map((e) => e.key)).toEqual(expect.arrayContaining(["X-Frame-Options", "Content-Security-Policy-Report-Only"]));
  });

  it("la caméra reste fermée partout, sauf sur la page de Scan (origine du site seulement)", async () => {
    const regles = (await nextConfig.headers?.()) ?? [];
    expect(valeur(regles[0].headers, "Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(valeur(regles[1].headers, "Permissions-Policy")).toBe("camera=(self), microphone=(), geolocation=()");
    expect(valeur(entetesSecurite({ production: true, scan: true }), "Permissions-Policy")).not.toContain("camera=()");
    // Jamais un joker ni une origine tierce.
    expect(valeur(regles[1].headers, "Permissions-Policy")).not.toMatch(/\*|https?:/);
  });

  it("les deux règles (moteur de chemins de Next) ne se recouvrent jamais et couvrent toutes les adresses", async () => {
    // Le moteur de chemins compilé dans Next (celui qui lit les sources de headers()), sans fichier de types.
    const moteur = "next/dist/compiled/path-to-regexp";
    const { pathToRegexp } = (await import(/* @vite-ignore */ moteur)) as { pathToRegexp: (source: string) => RegExp };
    const hors = pathToRegexp(SOURCE_HORS_SCAN);
    const scan = pathToRegexp(SOURCE_SCAN);
    const scans = ["/fr/scan", "/fr/scan/", "/fr/scan/x", "/en/scan", "/en/scan/x/y"];
    const autres = ["/", "/fr", "/en", "/fr/scanner", "/fr/scan-x", "/en/admin/scan", "/fr/compte/pass", "/fr/festival", "/fr/admin/evenements", "/api/sante", "/robots.txt"];
    for (const chemin of scans) {
      expect(scan.exec(chemin) !== null, `${chemin} dans Scan`).toBe(true);
      expect(hors.exec(chemin) !== null, `${chemin} hors Scan`).toBe(false);
    }
    for (const chemin of autres) {
      expect(hors.exec(chemin) !== null, `${chemin} hors Scan`).toBe(true);
      expect(scan.exec(chemin) !== null, `${chemin} dans Scan`).toBe(false);
    }
  });

  it("le module WebAssembly du lecteur de Code QR n'est autorisé que sur la page de Scan, sans CDN tiers", () => {
    const options = { adresseSupabase: "https://projet.supabase.co", production: true };
    expect(politiqueContenu(options)).not.toContain("wasm-unsafe-eval");
    const csp = politiqueContenu({ ...options, scan: true });
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");
    expect(csp).not.toMatch(/jsdelivr|unpkg/);
    expect(csp).toContain("connect-src 'self'");
  });

  it("autorise seulement le CDN public de Bunny comme média externe (héros, extrait HLS en blob:), et l'API de Bunny pour l'envoi", () => {
    const csp = politiqueContenu({ adresseSupabase: "https://projet.supabase.co", hoteVideoPublic: "vz-test.b-cdn.net", production: true });
    expect(csp).toContain("media-src 'self' blob: https://vz-test.b-cdn.net");
    expect(csp).toContain("connect-src 'self' https://projet.supabase.co https://video.bunnycdn.com https://vz-test.b-cdn.net");
    expect(csp).toContain("img-src 'self' data: blob: https://vz-test.b-cdn.net");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(politiqueContenu({ production: true })).toContain("media-src 'self' blob:;");
  });
});
