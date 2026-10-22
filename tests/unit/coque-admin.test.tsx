// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const chemin = vi.hoisted(() => ({ courant: "/admin/reglages" }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => chemin.courant,
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { CoqueAdmin } from "@/components/admin/CoqueAdmin";

describe("CoqueAdmin", () => {
  it("une navigation « Administration » avec la seule entrée Réglages, marquée courante", () => {
    chemin.courant = "/admin/reglages";
    rendre(
      <CoqueAdmin>
        <h1>Contenu</h1>
      </CoqueAdmin>,
    );
    const nav = screen.getByRole("navigation", { name: "Administration" });
    const liens = within(nav).getAllByRole("link");
    expect(liens.map((l) => l.textContent)).toEqual(["Réglages"]);
    expect(liens[0].getAttribute("href")).toBe("/admin/reglages");
    expect(liens[0].getAttribute("aria-current")).toBe("page");
    // Barre rouge de 4 px sur l'entrée courante, cible tactile de 44 px.
    expect(liens[0].className).toContain("border-primary");
    expect(liens[0].className).toContain("border-t-4");
    expect(liens[0].className).toContain("md:border-l-4");
    expect(liens[0].className).toContain("min-h-touch");
    expect(screen.getByRole("heading", { name: "Contenu" })).toBeTruthy();
  });

  it("barre d'onglets fixe de 58 px sur mobile, barre latérale sur ordinateur", () => {
    rendre(<CoqueAdmin>x</CoqueAdmin>);
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("h-[58px]");
    expect(nav.className).toContain("md:sticky");
    expect(nav.hasAttribute("data-barre-admin")).toBe(true);
  });

  it("hors de la page Réglages, l'entrée n'est pas courante", () => {
    chemin.courant = "/admin";
    rendre(<CoqueAdmin>x</CoqueAdmin>);
    const lien = screen.getByRole("link", { name: "Réglages" });
    expect(lien.getAttribute("aria-current")).toBeNull();
    expect(lien.className).toContain("border-transparent");
  });

  it("libellés en anglais", () => {
    chemin.courant = "/admin/reglages";
    rendre(<CoqueAdmin>x</CoqueAdmin>, "en");
    expect(within(screen.getByRole("navigation", { name: "Administration" })).getByRole("link", { name: "Settings" })).toBeTruthy();
  });
});
