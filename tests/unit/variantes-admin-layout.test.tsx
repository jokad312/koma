// @vitest-environment jsdom
// Story 9.16 b (revue de code) : les variantes réelles « rond » (thème, langue) et « menu » (déconnexion) de la barre du haut de l'admin,
// et le menu du profil avec le vrai bouton de déconnexion (sans double).
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/fr/admin/commandes",
}));
vi.mock("@/modules/comptes/actions", () => ({ deconnecter: vi.fn(async () => ({ erreur: false })) }));

import { MenuProfil } from "@/components/admin/MenuProfil";
import { BasculeTheme } from "@/components/layout/BasculeTheme";
import { BoutonDeconnexion } from "@/components/layout/BoutonDeconnexion";
import { SelecteurLangue } from "@/components/layout/SelecteurLangue";

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
});

describe("variante « rond » de BasculeTheme", () => {
  it("icône seule, même nom accessible ; bascule le thème dans les deux sens avec aria-pressed", async () => {
    const user = userEvent.setup();
    rendre(<BasculeTheme variante="rond" />);
    const bouton = screen.getByRole("button", { name: "Thème sombre" });
    expect(bouton.textContent).toBe("");
    expect(bouton.className).toContain("size-11");
    expect(bouton.className).toContain("border-transparent");
    expect(bouton.getAttribute("aria-pressed")).toBe("false");
    await user.click(bouton);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(bouton.getAttribute("aria-pressed")).toBe("true");
    await user.click(bouton);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(bouton.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("variante « rond » de SelecteurLangue", () => {
  it("depuis /fr : langue actuelle « FR » visible, nom accessible « Changer de langue : English », lien vers la même page en anglais", () => {
    rendre(<SelecteurLangue variante="rond" />);
    const lien = screen.getByRole("link", { name: "Changer de langue : English" });
    expect(lien.textContent).toBe("FR");
    expect(lien.getAttribute("href")).toBe("/en/admin/commandes");
    expect(lien.getAttribute("hreflang")).toBe("en");
    expect(lien.className).toContain("size-11");
  });

  it("depuis /en : langue actuelle « EN » visible, nom accessible « Switch language: Français »", () => {
    rendre(<SelecteurLangue variante="rond" />, "en");
    const lien = screen.getByRole("link", { name: "Switch language: Français" });
    expect(lien.textContent).toBe("EN");
  });
});

describe("variante « menu » de BoutonDeconnexion", () => {
  it("entrée du menu du profil (data-entree-profil, 44 px, pleine largeur), libellé traduit", () => {
    rendre(<BoutonDeconnexion variante="menu" />);
    const bouton = screen.getByRole("button", { name: "Se déconnecter" });
    expect(bouton.hasAttribute("data-entree-profil")).toBe(true);
    expect(bouton.className).toContain("min-h-touch");
    expect(bouton.className).toContain("w-full");
  });

  it("en anglais", () => {
    rendre(<BoutonDeconnexion variante="menu" />, "en");
    expect(screen.getByRole("button", { name: "Sign out" }).hasAttribute("data-entree-profil")).toBe(true);
  });

  it("variante par défaut : pastille, hors de la navigation du menu du profil", () => {
    rendre(<BoutonDeconnexion />);
    expect(screen.getByRole("button", { name: "Se déconnecter" }).hasAttribute("data-entree-profil")).toBe(false);
  });
});

describe("MenuProfil avec le vrai bouton de déconnexion", () => {
  it("Fin mène à « Se déconnecter », Début à « Mon profil » ; Échap rend le focus à l'avatar", async () => {
    const user = userEvent.setup();
    rendre(<MenuProfil profil={{ affichage: "TEST Admin", initiales: "TA", role: "Administrateur" }} lienAide={null} />);
    const avatar = screen.getByRole("button", { name: "TA, menu du profil : TEST Admin, Administrateur" });
    avatar.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement?.textContent).toBe("Mon profil");
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Se déconnecter" }));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent).toBe("Mon profil");
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(avatar);
    expect(avatar.getAttribute("aria-expanded")).toBe("false");
  });
});
