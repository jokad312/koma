// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContenuArticle } from "@/components/blog/ContenuArticle";

// Rendu Markdown (story 8.6) : le HTML brut, les scripts, les attributs d'événement et les protocoles dangereux ne
// peuvent jamais s'exécuter ni produire un lien actif.
describe("ContenuArticle", () => {
  it("n'exécute jamais un script ni un attribut d'événement", () => {
    const { container } = render(<ContenuArticle texte={'<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">'} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
    expect(container.innerHTML).not.toContain("alert(1)");
  });

  it("neutralise iframe, style, javascript: en casse mixte ou avec tabulation, et lien de référence", () => {
    const texte = [
      '<iframe src="https://example.org"></iframe>',
      '<p style="color:red" onclick="alert(1)">x</p>',
      "[a](JaVaScRiPt:alert(1))",
      "[b](java" + String.fromCharCode(9) + "script:alert(1))",
      "[c][ref]",
      "[ref]: javascript:alert(1)",
    ].join(String.fromCharCode(10, 10));
    const { container } = render(<ContenuArticle texte={texte} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.innerHTML.toLowerCase()).not.toContain("javascript:");
  });

  it("neutralise javascript: et data: sans laisser de lien actif", () => {
    const { container } = render(<ContenuArticle texte={"[piege](javascript:alert(1))\n\n![piege](data:image/png;base64,AAAA)"} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("javascript:");
    expect(container.innerHTML).not.toContain("data:");
  });

  it("garde un lien externe http(s) avec rel=noopener noreferrer", () => {
    const { container } = render(<ContenuArticle texte={"[Exemple](https://example.org/page)"} />);
    const lien = container.querySelector("a");
    expect(lien?.getAttribute("href")).toBe("https://example.org/page");
    expect(lien?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(lien?.getAttribute("target")).toBe("_blank");
  });

  it("garde un lien interne sans target ni rel", () => {
    const { container } = render(<ContenuArticle texte={"[Voir le produit](/fr/produits/test)"} />);
    const lien = container.querySelector("a");
    expect(lien?.getAttribute("href")).toBe("/fr/produits/test");
    expect(lien?.getAttribute("rel")).toBeNull();
    expect(lien?.getAttribute("target")).toBeNull();
  });

  it("rend les titres, listes et tableaux GFM", () => {
    const { container } = render(<ContenuArticle texte={"# Titre\n\n- un\n- deux\n\n| a | b |\n| - | - |\n| 1 | 2 |"} />);
    expect(container.querySelector("h2")?.textContent).toBe("Titre");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("décale les titres d'un cran pour ne garder qu'un seul H1 (celui de l'Article), h6 au maximum", () => {
    const { container } = render(
      <ContenuArticle texte={"# un\n\n## deux\n\n### trois\n\n#### quatre\n\n##### cinq\n\n###### six"} />,
    );
    expect(container.querySelector("h1")).toBeNull();
    const titres = [...container.querySelectorAll("h2, h3, h4, h5, h6")].map((t) => `${t.tagName.toLowerCase()}:${t.textContent}`);
    expect(titres).toEqual(["h2:un", "h3:deux", "h4:trois", "h5:quatre", "h6:cinq", "h6:six"]);
  });

  it("n'affiche pas une image sans texte alternatif", () => {
    const { container } = render(<ContenuArticle texte={"![](/fr/photo.jpg)"} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("affiche une image interne avec son texte alternatif", () => {
    const { container } = render(<ContenuArticle texte={"![Une photo](/fr/photo.jpg)"} />);
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("/fr/photo.jpg");
    expect(image?.getAttribute("alt")).toBe("Une photo");
  });
});
