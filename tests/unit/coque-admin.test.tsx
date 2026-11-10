// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("une navigation « Administration » avec Tableau de bord, Commandes, Produits, Univers, Blog, Galerie, Codes promo, Messages, Tâches, Prestataires et Réglages, la page courante marquée", async () => {
    chemin.courant = "/admin/reglages";
    compteur.valeur = 0;
    rendre(await coque(<h1>Contenu</h1>));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    const liens = within(nav).getAllByRole("link");
    expect(liens.map((l) => l.textContent)).toEqual(["Tableau de bord", "Commandes", "Produits", "Univers", "Blog", "Galerie", "Codes promo", "Messages", "Tâches", "Prestataires", "Réglages"]);
    expect(liens.map((l) => l.getAttribute("href"))).toEqual(["/admin", "/admin/commandes", "/admin/produits", "/admin/univers", "/admin/blog", "/admin/galerie", "/admin/codes-promo", "/admin/messages", "/admin/taches", "/admin/prestataires", "/admin/reglages"]);
    expect(liens[10].getAttribute("aria-current")).toBe("page");
    expect(liens[0].getAttribute("aria-current")).toBeNull();
    expect(liens[1].getAttribute("aria-current")).toBeNull();
    // Barre rouge de 4 px sur l'entrée courante, cible tactile de 44 px.
    expect(liens[10].className).toContain("border-primary");
    expect(liens[10].className).toContain("border-t-4");
    expect(liens[10].className).toContain("md:border-l-4");
    expect(liens[10].className).toContain("min-h-touch");
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

  describe("menu ☰ « Plus » sur mobile (UX-DR42)", () => {
    it("la barre du bas montre Tableau de bord, Commandes, Tâches et le bouton Plus (cible de 44 px, annoncé comme dialogue)", async () => {
      chemin.courant = "/admin/commandes";
      compteur.valeur = 0;
      rendre(await coque("x"));
      const nav = screen.getByRole("navigation", { name: "Administration" });
      const visibles = within(nav)
        .getAllByRole("link")
        .filter((l) => !l.closest("li")?.className.includes("hidden"));
      expect(visibles.map((l) => l.textContent)).toEqual(["Tableau de bord", "Commandes", "Tâches"]);
      const bouton = within(nav).getByRole("button", { name: /Plus/ });
      expect(bouton.className).toContain("min-h-touch");
      expect(bouton.getAttribute("aria-haspopup")).toBe("dialog");
      expect(bouton.getAttribute("aria-expanded")).toBe("false");
      expect(bouton.closest("li")?.className).toContain("md:hidden");
    });

    it("le bouton s'ouvre au clavier : dialogue avec les 8 autres pages, 44 px, focus dans le panneau, Échap ferme et rend le focus", async () => {
      chemin.courant = "/admin/commandes";
      const user = userEvent.setup();
      rendre(await coque("x"));
      const bouton = screen.getByRole("button", { name: /Plus/ });
      bouton.focus();
      await user.keyboard("{Enter}");
      const dialogue = screen.getByRole("dialog", { name: "Autres pages d'administration" });
      expect(bouton.getAttribute("aria-expanded")).toBe("true");
      const liens = within(dialogue).getAllByRole("link");
      expect(liens.map((l) => l.textContent)).toEqual(["Produits", "Univers", "Blog", "Galerie", "Codes promo", "Messages", "Prestataires", "Réglages"]);
      for (const lien of liens) expect(lien.className).toContain("min-h-touch");
      expect(dialogue.contains(document.activeElement)).toBe(true);
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(bouton);
    });

    it("page courante parmi les autres : le bouton porte le trait rouge et l'annonce ; le lien du panneau est aria-current", async () => {
      chemin.courant = "/admin/reglages";
      const user = userEvent.setup();
      rendre(await coque("x"));
      const bouton = screen.getByRole("button", { name: /Plus/ });
      expect(bouton.className).toContain("border-primary");
      expect(bouton.textContent).toContain("page actuelle : Réglages");
      await user.click(bouton);
      const dialogue = screen.getByRole("dialog");
      expect(within(dialogue).getByRole("link", { name: "Réglages" }).getAttribute("aria-current")).toBe("page");
      expect(within(dialogue).getByRole("link", { name: "Produits" }).getAttribute("aria-current")).toBeNull();
    });

    it("page courante parmi les principales : le bouton n'est pas marqué", async () => {
      chemin.courant = "/admin/taches";
      rendre(await coque("x"));
      const bouton = screen.getByRole("button", { name: /Plus/ });
      expect(bouton.className).toContain("border-transparent");
      expect(bouton.textContent).not.toContain("page actuelle");
    });

    it("choisir une page ferme le panneau", async () => {
      chemin.courant = "/admin";
      const user = userEvent.setup();
      rendre(await coque("x"));
      await user.click(screen.getByRole("button", { name: /Plus/ }));
      await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Blog" }));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("le compteur de messages est annoncé sur le bouton et dans le panneau", async () => {
      chemin.courant = "/admin";
      compteur.valeur = 2;
      const user = userEvent.setup();
      rendre(await coque("x"));
      const bouton = screen.getByRole("button", { name: /Plus/ });
      expect(bouton.textContent).toContain("2 nouveaux messages");
      await user.click(bouton);
      expect(within(screen.getByRole("dialog")).getByRole("link", { name: /Messages/ }).textContent).toContain("2 nouveaux messages");
    });

    it("le panneau se ferme si la fenêtre passe à la largeur ordinateur", async () => {
      chemin.courant = "/admin";
      let surChangement: (() => void) | null = null;
      const mq = { matches: false, addEventListener: (_: string, f: () => void) => (surChangement = f), removeEventListener: () => {} };
      vi.stubGlobal("matchMedia", () => mq);
      try {
        const user = userEvent.setup();
        rendre(await coque("x"));
        await user.click(screen.getByRole("button", { name: /Plus/ }));
        expect(screen.getByRole("dialog")).toBeTruthy();
        mq.matches = true;
        await act(async () => surChangement?.());
        expect(screen.queryByRole("dialog")).toBeNull();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("libellés en anglais", async () => {
      chemin.courant = "/admin";
      const user = userEvent.setup();
      rendre(await coque("x"), "en");
      await user.click(screen.getByRole("button", { name: /More/ }));
      expect(screen.getByRole("dialog", { name: "More admin pages" })).toBeTruthy();
    });
  });

  it("lecture du compteur impossible : pas de compteur, jamais un faux zéro", async () => {
    compteur.valeur = null;
    rendre(await coque("x"));
    expect(screen.getByRole("link", { name: "Messages" }).textContent).toBe("Messages");
  });
});
