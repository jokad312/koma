// @vitest-environment jsdom
import { screen } from "@testing-library/react";
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
