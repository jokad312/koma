import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TitreVitrine } from "@/components/ui/TitreVitrine";

// Rendu côté serveur : depuis 9.16 a), une seule police (KOMA Chikara) ; le titre garde toujours ses accents et son rôle t-*.
describe("TitreVitrine (rendu serveur)", () => {
  it("titre écrit avec ses accents, rôle selon le niveau", () => {
    expect(renderToStaticMarkup(<TitreVitrine niveau={1}>Accès</TitreVitrine>)).toBe('<h1 class="titre-vitrine t-h1">Accès</h1>');
    expect(renderToStaticMarkup(<TitreVitrine niveau={2}>CATÉGORIES</TitreVitrine>)).toBe('<h2 class="titre-vitrine t-h2">CATÉGORIES</h2>');
    expect(renderToStaticMarkup(<TitreVitrine niveau={3}>L’atelier</TitreVitrine>)).toBe('<h3 class="titre-vitrine t-h2">L’atelier</h3>');
  });

  it("titre venu de la base (donnee) et rôle display : jamais réécrit", () => {
    expect(renderToStaticMarkup(<TitreVitrine niveau={1} donnee role="display">Épée de Zoro</TitreVitrine>)).toBe(
      '<h1 class="titre-vitrine t-display">Épée de Zoro</h1>',
    );
  });

  it("aucune trace de l'ancienne option de police des titres", () => {
    expect(renderToStaticMarkup(<TitreVitrine niveau={1}>KOMA</TitreVitrine>)).not.toContain("data-police");
  });
});
