// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const chemin = vi.hoisted(() => ({ courant: "/admin/reglages" }));
const compteur = vi.hoisted(() => ({ valeur: 0 as number | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/admin/queries", () => ({ compterMessagesNouveaux: async () => compteur.valeur }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => chemin.courant,
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { CoqueAdmin } from "@/components/admin/CoqueAdmin";

// CoqueAdmin est asynchrone (compteur lu par le client service) : on l'appelle puis on rend l'élément obtenu.
async function coque(enfants: React.ReactNode) {
  return CoqueAdmin({ children: enfants });
}

describe("CoqueAdmin", () => {
  it("une navigation « Administration » avec Produits, Univers, Messages et Réglages, la page courante marquée", async () => {
    chemin.courant = "/admin/reglages";
    compteur.valeur = 0;
    rendre(await coque(<h1>Contenu</h1>));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    const liens = within(nav).getAllByRole("link");
    expect(liens.map((l) => l.textContent)).toEqual(["Produits", "Univers", "Messages", "Réglages"]);
    expect(liens.map((l) => l.getAttribute("href"))).toEqual(["/admin/produits", "/admin/univers", "/admin/messages", "/admin/reglages"]);
    expect(liens[3].getAttribute("aria-current")).toBe("page");
    expect(liens[0].getAttribute("aria-current")).toBeNull();
    // Barre rouge de 4 px sur l'entrée courante, cible tactile de 44 px.
    expect(liens[3].className).toContain("border-primary");
    expect(liens[3].className).toContain("border-t-4");
    expect(liens[3].className).toContain("md:border-l-4");
    expect(liens[3].className).toContain("min-h-touch");
    expect(screen.getByRole("heading", { name: "Contenu" })).toBeTruthy();
  });

  it("barre d'onglets fixe de 58 px sur mobile, barre latérale sur ordinateur", async () => {
    rendre(await coque("x"));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("h-[58px]");
    expect(nav.className).toContain("md:sticky");
    expect(nav.hasAttribute("data-barre-admin")).toBe(true);
  });

  it("hors des pages listées, aucune entrée n'est courante", async () => {
    chemin.courant = "/admin";
    rendre(await coque("x"));
    const lien = screen.getByRole("link", { name: "Réglages" });
    expect(lien.getAttribute("aria-current")).toBeNull();
    expect(lien.className).toContain("border-transparent");
  });

  it("libellés en anglais", async () => {
    chemin.courant = "/admin/reglages";
    rendre(await coque("x"), "en");
    expect(within(screen.getByRole("navigation", { name: "Administration" })).getByRole("link", { name: "Settings" })).toBeTruthy();
  });

  it("compteur de messages : affiché quand il y en a, annoncé aux lecteurs d'écran", async () => {
    compteur.valeur = 3;
    rendre(await coque("x"));
    const lien = screen.getByRole("link", { name: /Messages/ });
    expect(lien.textContent).toContain("3");
    expect(lien.textContent).toContain("3 nouveaux messages");
  });

  it("aucun nouveau message : pas de compteur (pas de « 0 »)", async () => {
    compteur.valeur = 0;
    rendre(await coque("x"));
    expect(screen.getByRole("link", { name: "Messages" }).textContent).toBe("Messages");
  });

  it("lecture du compteur impossible : pas de compteur, jamais un faux zéro", async () => {
    compteur.valeur = null;
    rendre(await coque("x"));
    expect(screen.getByRole("link", { name: "Messages" }).textContent).toBe("Messages");
  });
});
