// @vitest-environment jsdom
// Story 9.12 : bouton rond « compte » de l'en-tête visiteur. Nom accessible selon la connexion, ouverture au clavier, Échap ferme et rend le focus.
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr" }));

import { MenuCompteRond } from "@/components/layout/MenuCompteRond";
import { useFermerMenu } from "@/components/layout/MenuPanneau";

describe("MenuCompteRond", () => {
  it("visiteur : « Se connecter » ; connecté : « Mon compte »", () => {
    const { unmount } = rendre(
      <MenuCompteRond connecte={false}>
        <button type="button">TEST_lien</button>
      </MenuCompteRond>,
    );
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeTruthy();
    unmount();
    rendre(
      <MenuCompteRond connecte>
        <button type="button">TEST_lien</button>
      </MenuCompteRond>,
    );
    expect(screen.getByRole("button", { name: "Mon compte" })).toBeTruthy();
  });

  it("s'ouvre au clavier, Échap ferme et rend le focus au bouton ; un clic dehors ferme", async () => {
    const u = userEvent.setup();
    rendre(
      <>
        <MenuCompteRond connecte={false}>
          <button type="button">TEST_lien</button>
        </MenuCompteRond>
        <p>TEST_dehors</p>
      </>,
    );
    const bouton = screen.getByRole("button", { name: "Se connecter" });
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "TEST_lien" })).toBeNull();
    bouton.focus();
    await u.keyboard("{Enter}");
    expect(bouton.getAttribute("aria-expanded")).toBe("true");
    await u.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "TEST_lien" }));
    await u.keyboard("{Escape}");
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(bouton);
    await u.click(bouton);
    await u.click(screen.getByText("TEST_dehors"));
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
  });
  it("Échap avec le focus hors de la zone : le panneau se ferme sans voler le focus", async () => {
    const u = userEvent.setup();
    rendre(
      <>
        <MenuCompteRond connecte={false}>
          <button type="button">TEST_lien</button>
        </MenuCompteRond>
        <input aria-label="TEST_champ" />
      </>,
    );
    const bouton = screen.getByRole("button", { name: "Se connecter" });
    await u.click(bouton);
    screen.getByRole("textbox", { name: "TEST_champ" }).focus();
    await u.keyboard("{Escape}");
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "TEST_champ" }));
  });

  it("un contrôle du panneau qui demande la fermeture (déconnexion) ferme et rend le focus au bouton", async () => {
    const u = userEvent.setup();
    function Fermeur() {
      const fermer = useFermerMenu();
      return (
        <button type="button" onClick={fermer}>
          TEST_fermer
        </button>
      );
    }
    rendre(
      <MenuCompteRond connecte>
        <Fermeur />
      </MenuCompteRond>,
    );
    const bouton = screen.getByRole("button", { name: "Mon compte" });
    await u.click(bouton);
    await u.click(screen.getByRole("button", { name: "TEST_fermer" }));
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(bouton);
  });
});
