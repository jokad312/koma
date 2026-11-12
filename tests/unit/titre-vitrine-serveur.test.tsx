import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitreVitrine } from "@/components/ui/TitreVitrine";

// Rendu côté serveur (environnement Node) : le choix de police se fait sur le titre entier.
describe("TitreVitrine (rendu serveur)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle_publique");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("option Sakura active : « Accès » est écrit sans accent en Sakura Town, « L’accès » (apostrophe absente) reste en Barlow Condensed avec ses accents", () => {
    vi.stubEnv("NEXT_PUBLIC_TITRES_SAKURA", "true");
    expect(renderToStaticMarkup(<TitreVitrine niveau={1}>Accès</TitreVitrine>)).toContain('data-police="sakura"');
    expect(renderToStaticMarkup(<TitreVitrine niveau={1}>Accès</TitreVitrine>)).toContain(">Acces<");
    const autre = renderToStaticMarkup(<TitreVitrine niveau={1}>L’accès</TitreVitrine>);
    expect(autre).toContain('data-police="condensee"');
    expect(autre).toContain(">L’accès<");
    expect(renderToStaticMarkup(<TitreVitrine niveau={1}>KOMA</TitreVitrine>)).toContain('data-police="sakura"');
  });

  it("titre venu de la base (donnee) : jamais réécrit, Barlow avec ses accents même si Sakura est active", () => {
    vi.stubEnv("NEXT_PUBLIC_TITRES_SAKURA", "true");
    const rendu = renderToStaticMarkup(<TitreVitrine niveau={1} donnee>Épée de Zoro</TitreVitrine>);
    expect(rendu).toContain('data-police="condensee"');
    expect(rendu).toContain(">Épée de Zoro<");
  });

  it("option éteinte (défaut) : tous les titres en Barlow Condensed", () => {
    expect(renderToStaticMarkup(<TitreVitrine niveau={1}>KOMA</TitreVitrine>)).toContain('data-police="condensee"');
    vi.stubEnv("NEXT_PUBLIC_TITRES_SAKURA", "");
    expect(renderToStaticMarkup(<TitreVitrine niveau={2}>KOMA</TitreVitrine>)).toMatch(/^<h2 data-police="condensee"/);
  });
});
