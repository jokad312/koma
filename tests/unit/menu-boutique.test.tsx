// @vitest-environment jsdom
// Story 9.15, option C : entrée « Boutique » de l'en-tête (bouton + panneau de liens). Aucune donnée réelle.
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { MenuBoutique } from "@/components/layout/MenuBoutique";
import { RUBRIQUES, RUBRIQUES_BOUTIQUE, RUBRIQUES_DIRECTES } from "@/components/layout/rubriques";

const LIENS = [
  { href: "/cosplays", libelle: "Cosplays" },
  { href: "/accessoires", libelle: "Accessoires" },
  { href: "/vetements", libelle: "Vêtements" },
  { href: "/autres-articles", libelle: "Autres articles" },
  { href: "/kits", libelle: "Kits" },
];

function monter() {
  rendre(
    <div>
      <MenuBoutique libelle="Boutique" liens={LIENS} />
      <button type="button">Après</button>
    </div>,
  );
  return screen.getByRole("button", { name: "Boutique" });
}

describe("rubriques", () => {
  it("cinq catalogues sous « Boutique », puis Festival, Blog et À propos en liens directs", () => {
    expect(RUBRIQUES_BOUTIQUE.map((r) => r.cle)).toEqual(["cosplays", "accessoires", "vetements", "autresArticles", "kits"]);
    expect(RUBRIQUES_DIRECTES.map((r) => r.cle)).toEqual(["festival", "blog", "aPropos"]);
    expect(RUBRIQUES).toEqual([...RUBRIQUES_BOUTIQUE, ...RUBRIQUES_DIRECTES]);
  });
});

describe("MenuBoutique", () => {
  it("fermé au départ ; aria-expanded et aria-controls ; le clic ouvre le panneau et ses cinq liens", async () => {
    const user = userEvent.setup();
    const bouton = monter();
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    const panneau = document.getElementById(bouton.getAttribute("aria-controls") ?? "");
    expect(panneau?.hidden).toBe(true);
    expect(screen.queryByRole("link", { name: "Vêtements" })).toBeNull();
    await user.click(bouton);
    expect(bouton.getAttribute("aria-expanded")).toBe("true");
    expect(panneau?.hidden).toBe(false);
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Cosplays", "Accessoires", "Vêtements", "Autres articles", "Kits"]);
    // Motif bouton + panneau : jamais un role="menu".
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Échap ferme et rend le focus au bouton", async () => {
    const user = userEvent.setup();
    const bouton = monter();
    await user.click(bouton);
    await user.tab();
    expect(document.activeElement?.textContent).toBe("Cosplays");
    await user.keyboard("{Escape}");
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(bouton);
  });

  it("Tab sort normalement et ferme le panneau ; un clic à côté ferme", async () => {
    const user = userEvent.setup();
    const bouton = monter();
    await user.click(bouton);
    for (let i = 0; i < 6; i += 1) await user.tab();
    expect(document.activeElement?.textContent).toBe("Après");
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    await user.click(bouton);
    expect(bouton.getAttribute("aria-expanded")).toBe("true");
    fireEvent.mouseDown(document.body);
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
  });
});
