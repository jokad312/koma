// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BasculeTheme } from "@/components/layout/BasculeTheme";
import { ID_RACINE_PAGE } from "@/components/layout/constantes";
import { MenuPanneau } from "@/components/layout/MenuPanneau";
import { SelecteurLangue } from "@/components/layout/SelecteurLangue";
import { formaterCookieLangue } from "@/lib/langue-cookie";
import { SCRIPT_THEME } from "@/lib/theme/script";
import { CLE_STOCKAGE_THEME } from "@/lib/theme/theme";
import { rendre } from "./aides-dom";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/fr/cosplays/x",
}));

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
  document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
});

describe("BasculeTheme", () => {
  it("bascule le thème, change aria-pressed et mémorise le choix", async () => {
    const user = userEvent.setup();
    rendre(<BasculeTheme />);
    const b = screen.getByRole("button", { name: "Thème sombre" });
    expect((b).getAttribute("aria-pressed")).toBe("false");
    await user.click(b);
    expect((b).getAttribute("aria-pressed")).toBe("true");
    expect((document.documentElement).getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(CLE_STOCKAGE_THEME)).toBe("dark");
    await user.click(b);
    expect((b).getAttribute("aria-pressed")).toBe("false");
    expect((document.documentElement).getAttribute("data-theme")).toBe("light");
  });

  it("stockage inaccessible : le thème s'applique quand même, sans erreur", async () => {
    const user = userEvent.setup();
    const espion = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("stockage bloqué");
    });
    rendre(<BasculeTheme />);
    await user.click(screen.getByRole("button", { name: "Thème sombre" }));
    expect((document.documentElement).getAttribute("data-theme")).toBe("dark");
    espion.mockRestore();
  });
});

describe("script de thème de <head>", () => {
  it("pose le thème sombre mémorisé avant le rendu", () => {
    window.localStorage.setItem(CLE_STOCKAGE_THEME, "dark");
    new Function(SCRIPT_THEME)();
    expect((document.documentElement).getAttribute("data-theme")).toBe("dark");
  });

  it("sans choix mémorisé ou stockage inaccessible : crème (aucun attribut)", () => {
    new Function(SCRIPT_THEME)();
    expect((document.documentElement).hasAttribute("data-theme")).toBe(false);
    const espion = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("stockage bloqué");
    });
    expect(() => new Function(SCRIPT_THEME)()).not.toThrow();
    expect((document.documentElement).hasAttribute("data-theme")).toBe(false);
    espion.mockRestore();
  });
});

describe("SelecteurLangue", () => {
  it("propose « English » sur la même page depuis /fr et écrit le cookie NEXT_LOCALE", async () => {
    const user = userEvent.setup();
    rendre(<SelecteurLangue />);
    const lien = screen.getByRole("link", { name: "English" });
    expect((lien).getAttribute("href")).toBe("/en/cosplays/x");
    expect((lien).getAttribute("lang")).toBe("en");
    expect((lien).getAttribute("hreflang")).toBe("en");
    lien.addEventListener("click", (e) => e.preventDefault());
    await user.click(lien);
    expect(document.cookie).toContain("NEXT_LOCALE=en");
  });

  it("depuis /en propose « Français »", () => {
    rendre(<SelecteurLangue />, "en");
    expect((screen.getByRole("link", { name: "Français" })).getAttribute("hreflang")).toBe("fr");
  });

  it("le cookie dure un an, pour tout le site", () => {
    expect(formaterCookieLangue("en")).toBe("NEXT_LOCALE=en; path=/; max-age=31536000; samesite=lax");
  });
});

describe("MenuPanneau", () => {
  function Page() {
    return (
      <div id={ID_RACINE_PAGE}>
        <MenuPanneau>
          <a href="#rubrique">Kits</a>
        </MenuPanneau>
      </div>
    );
  }

  it("s'ouvre au clavier en dialogue, focus au premier élément, page inert, aria-expanded", async () => {
    const user = userEvent.setup();
    rendre(<Page />);
    const bouton = screen.getByRole("button", { name: /Menu/ });
    expect((bouton).getAttribute("aria-expanded")).toBe("false");
    bouton.focus();
    await user.keyboard("{Enter}");
    const d = screen.getByRole("dialog", { name: "Menu" });
    expect((d).getAttribute("aria-modal")).toBe("true");
    expect((bouton).getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(within(d).getByRole("button", { name: "Fermer le menu" }));
    expect(document.getElementById(ID_RACINE_PAGE)?.hasAttribute("inert")).toBe(true);
  });

  it("Échap ferme le menu et rend le focus au bouton ☰", async () => {
    const user = userEvent.setup();
    rendre(<Page />);
    const bouton = screen.getByRole("button", { name: /Menu/ });
    await user.click(bouton);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(bouton);
    expect((bouton).getAttribute("aria-expanded")).toBe("false");
  });

  it("le choix d'une rubrique ferme le menu", async () => {
    const user = userEvent.setup();
    rendre(<Page />);
    await user.click(screen.getByRole("button", { name: /Menu/ }));
    const rubrique = screen.getByRole("link", { name: "Kits" });
    rubrique.addEventListener("click", (e) => e.preventDefault());
    await user.click(rubrique);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
