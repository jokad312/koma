// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

let chemin = "/fr";
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => chemin,
}));

import { MenuPanneau, useFermerMenu } from "../../src/components/layout/MenuPanneau";

function BoutonFermer() {
  const fermer = useFermerMenu();
  return <button onClick={fermer}>Fermer depuis un contrôle</button>;
}

describe("menu ☰ : le titre « Menu » est un titre, pas un lien", () => {
  it("titre de niveau 2 relié au dialogue, ni cliquable ni dans un lien ou un bouton, d'aspect distinct des liens", async () => {
    const user = userEvent.setup();
    chemin = "/fr";
    rendre(
      <MenuPanneau>
        <a href="#cosplays" className="t-h3">
          Cosplays
        </a>
      </MenuPanneau>,
    );
    await user.click(screen.getByRole("button", { name: "Menu" }));
    const dialogue = screen.getByRole("dialog", { name: "Menu" });
    const titre = screen.getByRole("heading", { level: 2, name: "Menu" });
    expect(dialogue.getAttribute("aria-labelledby")).toBe(titre.id);
    expect(titre.closest("a, button")).toBeNull();
    expect(titre.querySelector("a, button")).toBeNull();
    expect(titre.getAttribute("tabindex")).toBeNull();
    expect(titre.getAttribute("role")).toBeNull();
    // Il n'existe aucun lien ni bouton nommé « Menu » dans le panneau (le bouton ☰ de la page est inerte et masqué par le dialogue).
    expect(within(dialogue).queryByRole("link", { name: "Menu" })).toBeNull();
    expect(within(dialogue).queryByRole("button", { name: "Menu" })).toBeNull();
    // Cliquer le titre ne ferme pas le menu et ne navigue pas.
    await user.click(titre);
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeTruthy();
    // Style : libellé discret en couleur secondaire, pas le t-h3 des liens.
    expect(titre.className).not.toContain("t-h3");
    expect(titre.className).toContain("text-text-secondary");
    expect(within(dialogue).getByRole("link", { name: "Cosplays" }).className).toContain("t-h3");
  });
});

describe("menu ☰ : fermeture", () => {
  it("toute navigation (changement d'adresse) ferme le menu", async () => {
    const user = userEvent.setup();
    chemin = "/fr";
    const { rerender } = rendre(<MenuPanneau>contenu</MenuPanneau>);
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeTruthy();
    chemin = "/fr/cosplays";
    rerender(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <MenuPanneau>contenu</MenuPanneau>
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
  });

  it("un contrôle du menu peut le fermer (déconnexion qui reste sur la même page)", async () => {
    const user = userEvent.setup();
    chemin = "/fr";
    rendre(
      <MenuPanneau>
        <BoutonFermer />
      </MenuPanneau>,
    );
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("button", { name: "Fermer depuis un contrôle" }));
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
  });
});
