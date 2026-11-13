// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const chemin = vi.hoisted(() => ({ courant: "/admin/reglages" }));
const compteur = vi.hoisted(() => ({ valeur: 0 as number | null }));
const compte = vi.hoisted(() => ({
  session: { compteId: "TEST_compte" } as { compteId: string } | null,
  role: "admin" as "admin" | "assistant" | "benevole" | null,
  utilisateur: { email: "alice.test@example.invalid", user_metadata: { full_name: "Alice Test" } } as { email: string; user_metadata: Record<string, unknown> } | null,
  erreur: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/admin/queries", () => ({ compterMessagesNouveaux: async () => compteur.valeur }));
vi.mock("@/lib/reglages", () => ({ lireNomSite: async () => "TEST_Boutique" }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("../../messages/fr.json")).default;
  return { getTranslations: async (namespace: string) => createTranslator({ locale: "fr", messages, namespace: namespace as never }) };
});
vi.mock("@/lib/auth/compte", () => ({
  lireSessionVerifiee: async () => {
    if (compte.erreur) throw new Error("TEST_panne");
    return compte.session;
  },
}));
vi.mock("@/lib/auth/droits", () => ({ lireRole: async () => compte.role }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({ auth: { admin: { getUserById: async () => ({ data: { user: compte.utilisateur }, error: null }) } } }),
}));
// Commandes du site reprises dans le bandeau : remplacées par des boutons simples (leurs propres tests sont ailleurs).
vi.mock("@/components/layout/BasculeTheme", () => ({ BasculeTheme: () => <button type="button">Thème</button> }));
vi.mock("@/components/layout/BoutonDeconnexion", () => ({ BoutonDeconnexion: () => <button type="button">Se déconnecter</button> }));
vi.mock("@/components/layout/SelecteurLangue", () => ({ SelecteurLangue: () => <button type="button">Langue</button> }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => chemin.courant,
  Link: ({ href, children, ...reste }: { href: string | { pathname: string; query?: Record<string, string> }; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query)}` : ""}`} {...reste}>
      {children}
    </a>
  ),
}));

import { CoqueAdmin, initialesDe, masquerEmail } from "@/components/admin/CoqueAdmin";

// CoqueAdmin est asynchrone (compteur, nom du site et Compte lus côté serveur) : on l'appelle puis on rend l'élément obtenu.
async function coque(enfants: React.ReactNode) {
  return CoqueAdmin({ children: enfants });
}

const NOMS_ADMIN = ["Tableau de bord", "Commandes", "Tâches", "Produits", "Univers", "Utilisateurs", "Événements", "Scan", "Galerie", "Blog", "Messages", "Codes promo", "Prestataires", "Réglages"];

beforeEach(() => {
  chemin.courant = "/admin/reglages";
  compteur.valeur = 0;
  compte.session = { compteId: "TEST_compte" };
  compte.role = "admin";
  compte.utilisateur = { email: "alice.test@example.invalid", user_metadata: { full_name: "Alice Test" } };
  compte.erreur = false;
});

describe("CoqueAdmin : disposition en L", () => {
  it("une navigation « Administration » en groupes (Navigation, Communauté, Réglages) avec toutes les pages une seule fois, la page courante marquée", async () => {
    rendre(await coque(<h1>Contenu</h1>));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    const liens = within(nav).getAllByRole("link");
    const noms = liens.map((l) => l.textContent);
    expect(noms.filter((n) => NOMS_ADMIN.includes(n ?? ""))).toEqual(NOMS_ADMIN);
    expect(liens.find((l) => l.textContent === "Réglages")?.getAttribute("href")).toBe("/admin/reglages");
    expect(liens.find((l) => l.textContent === "Utilisateurs")?.getAttribute("href")).toBe("/admin/utilisateurs");
    expect(liens.find((l) => l.textContent === "Scan")?.getAttribute("href")).toBe("/scan");
    const courante = liens.filter((l) => l.getAttribute("aria-current") === "page");
    expect(courante.map((l) => l.textContent)).toEqual(["Réglages"]);
    // Barre rouge de 4 px sur l'entrée courante, cible tactile de 44 px.
    expect(courante[0].className).toContain("border-primary");
    expect(courante[0].className).toContain("border-t-4");
    expect(courante[0].className).toContain("md:border-l-4");
    expect(courante[0].className).toContain("min-h-touch");
    expect(screen.getByRole("heading", { name: "Contenu" })).toBeTruthy();
    // Titres des groupes.
    for (const titre of ["Navigation", "Communauté", "Réglages"]) expect(within(nav).getAllByText(titre).length).toBeGreaterThan(0);
  });

  it("barre d'onglets fixe de 58 px sur mobile, barre latérale fixe à gauche sur ordinateur", async () => {
    rendre(await coque("x"));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("h-[58px]");
    expect(nav.className).toContain("md:inset-y-0");
    expect(nav.className).toContain("md:left-0");
    expect(nav.className).toContain("md:w-64");
    expect(nav.hasAttribute("data-barre-admin")).toBe(true);
  });

  it("la coquille porte « data-coque-admin » (le CSS retire alors l'en-tête et le pied du site) ; contenu décalé de la largeur de la barre sur ordinateur", async () => {
    const { container } = rendre(await coque(<p>Page</p>));
    const racine = container.querySelector("[data-coque-admin]");
    expect(racine).toBeTruthy();
    expect(racine?.querySelector(".md\\:pl-64")).toBeTruthy();
  });

  it("second lien d'évitement : mène au contenu de la page, après la barre latérale et le bandeau", async () => {
    const { container } = rendre(await coque(<p>Page</p>));
    const lien = screen.getByRole("link", { name: "Aller au contenu de la page" });
    expect(lien.getAttribute("href")).toBe("#contenu-admin");
    const cible = container.querySelector("#contenu-admin");
    expect(cible?.getAttribute("tabindex")).toBe("-1");
    expect(cible?.textContent).toBe("Page");
    // Le lien vient avant la navigation dans l'ordre du document.
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(lien.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("bloc de marque : logo (décoratif, le lien porte le nom) et nom du site lu dans les réglages, lien vers le site", async () => {
    rendre(await coque("x"));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getByText("TEST_Boutique")).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Voir le site TEST_Boutique" }).getAttribute("href")).toBe("/?vue=site");
  });

  it("encart « Besoin d'aide ? » avec le lien « Voir le site »", async () => {
    rendre(await coque("x"));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getByText("Besoin d'aide ?")).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Voir le site" }).getAttribute("href")).toBe("/?vue=site");
  });

  it("bandeau : sur-titre, titre de la section courante, nom et rôle du Compte connecté avec ses initiales", async () => {
    chemin.courant = "/admin/produits/TEST_id";
    rendre(await coque("x"));
    const bandeau = screen.getByRole("banner");
    expect(within(bandeau).getByText("Espace administrateur")).toBeTruthy();
    expect(within(bandeau).getByText("Produits")).toBeTruthy();
    expect(within(bandeau).getByText("Alice Test")).toBeTruthy();
    expect(within(bandeau).getByText("Administrateur")).toBeTruthy();
    expect(within(bandeau).getByRole("img", { name: "Alice Test, Administrateur" }).textContent).toBe("AT");
    // Réglages du site repris dans le bandeau (l'en-tête du site est masqué).
    for (const nom of ["Thème", "Langue", "Se déconnecter"]) expect(within(bandeau).getByRole("button", { name: nom })).toBeTruthy();
  });

  it("sans nom de Compte : l'email partiellement masqué (jamais l'adresse entière)", async () => {
    compte.utilisateur = { email: "alice.test@example.invalid", user_metadata: {} };
    rendre(await coque("x"));
    const bandeau = screen.getByRole("banner");
    expect(within(bandeau).getByText("al***@example.invalid")).toBeTruthy();
    expect(document.body.textContent).not.toContain("alice.test@example.invalid");
  });

  it("Compte illisible : pas de nom inventé dans le bandeau, la navigation reste là", async () => {
    compte.erreur = true;
    rendre(await coque("x"));
    expect(within(screen.getByRole("banner")).queryByRole("img")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Administration" })).toBeTruthy();
  });

  it("« Utilisateurs » : montré à l'Admin seulement (l'Assistant ne le voit pas)", async () => {
    compte.role = "assistant";
    rendre(await coque("x"));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).queryByRole("link", { name: "Utilisateurs" })).toBeNull();
    expect(within(nav).getByRole("link", { name: "Produits" })).toBeTruthy();
    expect(within(screen.getByRole("banner")).getByText("Assistant")).toBeTruthy();
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
    const nav = within(screen.getByRole("navigation", { name: "Administration" }));
    expect(nav.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(nav.getByRole("link", { name: "Users" })).toBeTruthy();
    expect(within(screen.getByRole("banner")).getByText("Administrator area")).toBeTruthy();
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
      rendre(await coque("x"));
      const nav = screen.getByRole("navigation", { name: "Administration" });
      const visibles = within(nav)
        .getAllByRole("link")
        .filter((l) => l.closest("li") && !l.closest("li")?.className.includes("hidden"));
      expect(visibles.map((l) => l.textContent)).toEqual(["Tableau de bord", "Commandes", "Tâches"]);
      const bouton = within(nav).getByRole("button", { name: /Plus/ });
      expect(bouton.className).toContain("min-h-touch");
      expect(bouton.getAttribute("aria-haspopup")).toBe("dialog");
      expect(bouton.getAttribute("aria-expanded")).toBe("false");
      expect(bouton.parentElement?.className).toContain("md:hidden");
    });

    it("le bouton s'ouvre au clavier : dialogue avec les autres pages et « Voir le site », 44 px, focus dans le panneau, Échap ferme et rend le focus", async () => {
      chemin.courant = "/admin/commandes";
      const user = userEvent.setup();
      rendre(await coque("x"));
      const bouton = screen.getByRole("button", { name: /Plus/ });
      bouton.focus();
      await user.keyboard("{Enter}");
      const dialogue = screen.getByRole("dialog", { name: "Autres pages d'administration" });
      expect(bouton.getAttribute("aria-expanded")).toBe("true");
      const liens = within(dialogue).getAllByRole("link");
      expect(liens.map((l) => l.textContent)).toEqual([...NOMS_ADMIN.slice(3), "Voir le site"]);
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
      expect(bouton.textContent).toBe("☰Plus");
      expect(bouton.getAttribute("aria-label")).toBe("Plus de pages, page actuelle : Réglages");
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
      expect(bouton.getAttribute("aria-label")).toBe("Plus de pages");
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
      expect(bouton.getAttribute("aria-label")).toBe("Plus de pages (2 nouveaux messages)");
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

describe("aides du bandeau", () => {
  it("initiales : deux mots, un seul mot, caractères spéciaux", () => {
    expect(initialesDe("Alice Test")).toBe("AT");
    expect(initialesDe("alice")).toBe("AL");
    expect(initialesDe("  jean   dupont ")).toBe("JD");
    expect(initialesDe("***")).toBe("");
  });
  it("email masqué : deux premiers caractères puis « *** » puis le domaine ; adresse invalide : vide", () => {
    expect(masquerEmail("alice.test@example.invalid")).toBe("al***@example.invalid");
    expect(masquerEmail("a@example.invalid")).toBe("a***@example.invalid");
    expect(masquerEmail("pas-une-adresse")).toBe("");
  });
});
