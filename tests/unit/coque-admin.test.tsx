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
const reglage = vi.hoisted(() => ({ whatsapp: null as string | null }));
vi.mock("@/lib/reglages", () => ({ lireNomSite: async () => "TEST_Boutique", lireNumeroWhatsappOuNull: async () => reglage.whatsapp }));
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
vi.mock("@/components/layout/BoutonDeconnexion", () => ({
  BoutonDeconnexion: ({ variante }: { variante?: string }) => (
    <button type="button" data-entree-profil={variante === "menu" ? "" : undefined} className={variante === "menu" ? "min-h-touch" : undefined}>
      Se déconnecter
    </button>
  ),
}));
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

// Ordre des maquettes (décision Q6 du 2026-11-15) : Prestataires avant Codes promo.
const NOMS_ADMIN = ["Tableau de bord", "Commandes", "Tâches", "Produits", "Univers", "Utilisateurs", "Événements", "Scan", "Galerie", "Blog", "Messages", "Prestataires", "Codes promo", "Réglages"];
// Droits par rôle (inchangés par la 9.16 b) : l'Assistant voit tout sauf « Utilisateurs » (droit roles.gerer).
const NOMS_ASSISTANT = NOMS_ADMIN.filter((n) => n !== "Utilisateurs");
const BOUTON_PROFIL = "AT, menu du profil : Alice Test, Administrateur";

beforeEach(() => {
  chemin.courant = "/admin/reglages";
  compteur.valeur = 0;
  reglage.whatsapp = null;
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
    // Entrée courante (décision 2 du 2026-11-16) : bloc de la couleur du fond, collé au bord droit, texte plus grand, trait rouge de 4 px (repère qui ne
    // dépend pas que de la couleur du fond), cible tactile de 44 px.
    expect(courante[0].className).toContain("border-primary");
    expect(courante[0].className).toContain("border-t-4");
    expect(courante[0].className).toContain("lg:border-l-4");
    expect(courante[0].className).toContain("lg:bg-admin-actif");
    expect(courante[0].className).toContain("lg:rounded-l-[14px]");
    expect(courante[0].className).toContain("lg:text-[18px]");
    expect(courante[0].className).toContain("min-h-touch");
    expect(screen.getByRole("heading", { name: "Contenu" })).toBeTruthy();
    // Titres des groupes (le premier n'est lu que par les lecteurs d'écran, comme sur la maquette).
    for (const titre of ["Navigation", "Communauté", "Réglages"]) expect(within(nav).getAllByText(titre).length).toBeGreaterThan(0);
    expect(within(nav).getByText("Navigation").className).toBe("sr-only");
  });

  it("barre d'onglets fixe de 58 px sous 1024 px, menu latéral fixe à gauche de 240 px à partir de 1024 px (lg)", async () => {
    rendre(await coque("x"));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("h-[58px]");
    expect(nav.className).toContain("lg:inset-y-0");
    expect(nav.className).toContain("lg:left-0");
    expect(nav.className).toContain("lg:w-60");
    expect(nav.className).toContain("lg:border-r-4");
    expect(nav.className).toContain("bg-admin-menu");
    expect(nav.className).not.toMatch(/(^|\s)md:/);
    expect(nav.hasAttribute("data-barre-admin")).toBe(true);
  });

  it("la coquille porte « data-coque-admin » (le CSS retire alors l'en-tête et le pied du site) ; contenu décalé de la largeur du menu à partir de lg", async () => {
    const { container } = rendre(await coque(<p>Page</p>));
    const racine = container.querySelector("[data-coque-admin]");
    expect(racine).toBeTruthy();
    expect(racine?.className).toContain("bg-admin-fond");
    expect(racine?.querySelector(".lg\\:pl-60")).toBeTruthy();
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

  it("bloc de marque : logo (décoratif, le lien porte le nom du site lu dans les réglages) vers le site, puis « ADMINISTRATION »", async () => {
    rendre(await coque("x"));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getByRole("link", { name: "Voir le site TEST_Boutique" }).getAttribute("href")).toBe("/fr?vue=site");
    expect(within(nav).getByText("Administration").className).toContain("t-label");
  });

  it("encart « Besoin d'aide ? » retiré du menu (Q7) : l'aide et « Voir le site » sont dans le menu du profil", async () => {
    rendre(await coque("x"));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).queryByText("Besoin d'aide ?")).toBeNull();
  });

  it("bandeau : sur-titre sur une ligne, titre de la section courante, thème et langue en ronds, nom et rôle, avatar qui ouvre le menu du profil", async () => {
    chemin.courant = "/admin/produits/TEST_id";
    rendre(await coque("x"));
    const bandeau = screen.getByRole("banner");
    expect(within(bandeau).getByText("Espace administrateur").className).toContain("whitespace-nowrap");
    expect(within(bandeau).getByText("Produits")).toBeTruthy();
    expect(within(bandeau).getAllByText("Alice Test").length).toBeGreaterThan(0);
    expect(within(bandeau).getAllByText("Administrateur").length).toBeGreaterThan(0);
    const avatar = within(bandeau).getByRole("button", { name: BOUTON_PROFIL });
    expect(avatar.textContent).toBe("AT");
    expect(avatar.className).toContain("bg-primary");
    expect(avatar.getAttribute("aria-expanded")).toBe("false");
    // Thème et langue restent dans la barre (l'en-tête du site est masqué) ; la déconnexion passe dans le menu du profil, fermé au départ.
    for (const nom of ["Thème", "Langue"]) expect(within(bandeau).getByRole("button", { name: nom })).toBeTruthy();
    expect(within(bandeau).queryByRole("button", { name: "Se déconnecter" })).toBeNull();
  });

  it("sans nom de Compte : l'email partiellement masqué (jamais l'adresse entière)", async () => {
    compte.utilisateur = { email: "alice.test@example.invalid", user_metadata: {} };
    rendre(await coque("x"));
    const bandeau = screen.getByRole("banner");
    expect(within(bandeau).getAllByText("al***@example.invalid").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("alice.test@example.invalid");
  });

  it("Compte illisible : ni nom, ni rôle, ni initiales inventés ; le menu du profil reste joignable (déconnexion), la navigation reste là", async () => {
    compte.erreur = true;
    const user = userEvent.setup();
    rendre(await coque("x"));
    const bandeau = screen.getByRole("banner");
    const bouton = within(bandeau).getByRole("button", { name: "Menu du profil" });
    expect(bouton.textContent).toBe("");
    expect(within(bandeau).queryByText("Administrateur")).toBeNull();
    await user.click(bouton);
    expect(within(bandeau).getByRole("button", { name: "Se déconnecter" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Administration" })).toBeTruthy();
  });

  it("droits par rôle : l'Admin voit les 14 entrées ; l'Assistant les mêmes sauf « Utilisateurs », rien de plus", async () => {
    compte.role = "assistant";
    rendre(await coque("x"));
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).queryByRole("link", { name: "Utilisateurs" })).toBeNull();
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => l.textContent)
        .filter((n) => NOMS_ADMIN.includes(n ?? "")),
    ).toEqual(NOMS_ASSISTANT);
    expect(within(screen.getByRole("banner")).getAllByText("Assistant").length).toBeGreaterThan(0);
  });

  it("Compte sans rôle d'administration lisible : aucune entrée réservée à l'Admin", async () => {
    compte.role = null;
    rendre(await coque("x"));
    expect(within(screen.getByRole("navigation", { name: "Administration" })).queryByRole("link", { name: "Utilisateurs" })).toBeNull();
  });

  describe("menu du profil (Q8)", () => {
    it("Entrée sur l'avatar : 5 entrées dans l'ordre, focus sur la première ; flèches, Échap ferme et rend le focus à l'avatar", async () => {
      const user = userEvent.setup();
      rendre(await coque("x"));
      const bandeau = screen.getByRole("banner");
      const avatar = within(bandeau).getByRole("button", { name: BOUTON_PROFIL });
      avatar.focus();
      await user.keyboard("{Enter}");
      expect(avatar.getAttribute("aria-expanded")).toBe("true");
      const menu = document.getElementById(avatar.getAttribute("aria-controls") ?? "");
      expect(menu?.hidden).toBe(false);
      const entrees = [...(menu?.querySelectorAll<HTMLElement>("[data-entree-profil]") ?? [])];
      expect(entrees.map((e) => e.textContent)).toEqual(["Mon profil", "Paramètres du profil", "Aide", "Voir le site", "Se déconnecter"]);
      for (const e of entrees) expect(e.className).toContain("min-h-touch");
      expect(entrees[0].getAttribute("href")).toBe("/fr/compte?vue=site");
      expect(entrees[1].getAttribute("href")).toBe("/fr/compte/preferences");
      expect(entrees[3].getAttribute("href")).toBe("/fr?vue=site");
      expect(document.activeElement).toBe(entrees[0]);
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(entrees[1]);
      await user.keyboard("{ArrowUp}{ArrowUp}");
      expect(document.activeElement).toBe(entrees[4]);
      await user.keyboard("{Home}");
      expect(document.activeElement).toBe(entrees[0]);
      await user.keyboard("{Escape}");
      expect(avatar.getAttribute("aria-expanded")).toBe("false");
      expect(menu?.hidden).toBe(true);
      expect(document.activeElement).toBe(avatar);
    });

    it("un clic à l'extérieur ferme le menu ; un Tab qui sort du menu aussi", async () => {
      const user = userEvent.setup();
      rendre(await coque(<button type="button">Ailleurs</button>));
      const avatar = screen.getByRole("button", { name: BOUTON_PROFIL });
      await user.click(avatar);
      expect(avatar.getAttribute("aria-expanded")).toBe("true");
      await user.click(screen.getByRole("button", { name: "Ailleurs" }));
      expect(avatar.getAttribute("aria-expanded")).toBe("false");
      await user.click(avatar);
      await user.keyboard("{End}");
      await user.tab();
      expect(avatar.getAttribute("aria-expanded")).toBe("false");
    });

    it("« Aide » ouvre une fenêtre avec le texte de l'ancien encart et le lien WhatsApp des réglages ; la fermeture rend le focus à l'avatar", async () => {
      reglage.whatsapp = "+243000000000";
      const user = userEvent.setup();
      rendre(await coque("x"));
      const avatar = screen.getByRole("button", { name: BOUTON_PROFIL });
      await user.click(avatar);
      await user.click(screen.getByRole("button", { name: "Aide" }));
      const dialogue = screen.getByRole("dialog", { name: "Besoin d'aide ?" });
      expect(within(dialogue).getByText("Consulte les données et gère ta boutique depuis cet espace.")).toBeTruthy();
      expect(within(dialogue).getByRole("link", { name: "Écrire sur WhatsApp" }).getAttribute("href")).toBe("https://wa.me/243000000000");
      // En-tête des fenêtres de la maquette : titre, puis croix « Fermer » en haut à droite, trait dessous ; plus de bouton texte « Fermer » au-dessus du titre.
      const titre = within(dialogue).getByRole("heading", { name: "Besoin d'aide ?" });
      const croix = within(dialogue).getByRole("button", { name: "Fermer" });
      expect(croix.textContent).toBe("");
      expect(titre.compareDocumentPosition(croix) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(titre.parentElement?.className).toContain("border-b-[3px]");
      expect(avatar.getAttribute("aria-expanded")).toBe("false");
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(avatar);
    });

    it("« Aide » sans numéro WhatsApp réglé : le texte seul, aucun lien inventé", async () => {
      const user = userEvent.setup();
      rendre(await coque("x"));
      await user.click(screen.getByRole("button", { name: BOUTON_PROFIL }));
      await user.click(screen.getByRole("button", { name: "Aide" }));
      const dialogue = screen.getByRole("dialog", { name: "Besoin d'aide ?" });
      expect(within(dialogue).queryByRole("link", { name: /WhatsApp/ })).toBeNull();
    });

    it("en anglais", async () => {
      const user = userEvent.setup();
      rendre(await coque("x"), "en");
      const avatar = screen.getByRole("button", { name: "AT, profile menu: Alice Test, Administrator" });
      await user.click(avatar);
      const menu = document.getElementById(avatar.getAttribute("aria-controls") ?? "");
      expect([...(menu?.querySelectorAll("[data-entree-profil]") ?? [])].map((e) => e.textContent)).toEqual(["My profile", "Profile settings", "Help", "View the site", "Se déconnecter"]);
      expect(menu?.querySelector("a")?.getAttribute("href")).toBe("/en/compte?vue=site");
    });
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
      expect(bouton.parentElement?.className).toContain("lg:hidden");
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
