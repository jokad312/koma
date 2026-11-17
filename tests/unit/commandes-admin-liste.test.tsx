// @vitest-environment jsdom
// Story 9.16 d) : liste des Commandes de l'admin selon la maquette (cartes, recherche, pastilles, colonne Client, pagination par 20).
// Le client service est simulé (aucune base) : on vérifie les paramètres envoyés à commandes_admin_liste et la lecture de sa réponse.
// Données de test nommées TEST_ : jamais utilisées hors des tests.
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({ rpc: faux.rpc }) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { adresseCommandes, ListeCommandesAdmin } from "@/components/admin/ListeCommandesAdmin";
import { lireRevenuPaye, listerCommandesAdmin, pageValide, rechercheValide, type CommandeAdminResume, type PageCommandesAdmin } from "@/modules/commande/admin-queries";

const TEST_AUTEUR = { type: "compte", id: "00000000-0000-0000-0000-0000000000aa", role: "assistant" } as const;
const TEST_CHIFFRES = { commandes_payees: 12, tentatives_reussies: 15, en_attente: 3 };

function ligneBase(n: number) {
  return {
    numero: `KS-2026-99${String(n).padStart(4, "0")}`,
    cree_le: "2026-11-17T08:00:00Z",
    statut: "payee",
    expire_le: null,
    total_cents: 5500,
    offerte: false,
    prestataire: "pawapay",
    zone: "goma",
    mode_remise: "livraison",
    client_nom: "TEST Aïcha",
    client_email_masque: "te***@example.invalid",
  };
}

// Accolades : une fonction rendue par beforeEach serait appelée comme nettoyage (mockReset rend le faux lui-même).
beforeEach(() => {
  faux.rpc.mockReset();
});

describe("lectures de la liste (9.16 d)", () => {
  it("paramètres contrôlés envoyés à commandes_admin_liste, page de 20 ; réponse lue champ par champ", async () => {
    faux.rpc.mockResolvedValue({ data: { total: 45, commandes: [ligneBase(1)], chiffres: TEST_CHIFFRES }, error: null });
    const r = await listerCommandesAdmin(TEST_AUTEUR, { statut: "payee", q: "ks-2026" }, 2);
    expect(faux.rpc).toHaveBeenCalledWith("commandes_admin_liste", {
      p_auteur: TEST_AUTEUR,
      p_statut: "payee",
      p_famille: undefined,
      p_prestataire: undefined,
      p_zone: undefined,
      p_recherche: "ks-2026",
      p_page: 2,
      p_taille: 20,
    });
    expect(r.total).toBe(45);
    expect(r.pages).toBe(3);
    expect(r.page).toBe(2);
    expect(r.chiffres).toEqual({ commandesPayees: 12, tentativesReussies: 15, enAttente: 3 });
    expect(r.commandes[0].client).toEqual({ nom: "TEST Aïcha", emailMasque: "te***@example.invalid" });
  });

  it("en attente dont l'échéance est passée : affichée « expirée » (même règle qu'avant)", async () => {
    faux.rpc.mockResolvedValue({ data: { total: 1, commandes: [{ ...ligneBase(1), statut: "en_attente", expire_le: "2020-01-01T00:00:00Z" }], chiffres: TEST_CHIFFRES }, error: null });
    expect((await listerCommandesAdmin(TEST_AUTEUR, {}, 1)).commandes[0].statut).toBe("expiree");
  });

  it("page au-delà de la dernière : la dernière page est relue", async () => {
    const pages: number[] = [];
    faux.rpc.mockImplementation(async (...args: unknown[]) => {
      const page = (args[1] as { p_page: number }).p_page;
      pages.push(page);
      return { data: { total: 45, commandes: page === 3 ? [ligneBase(41)] : [], chiffres: TEST_CHIFFRES }, error: null };
    });
    const r = await listerCommandesAdmin(TEST_AUTEUR, {}, 9);
    expect(pages).toEqual([9, 3]);
    expect(r.page).toBe(3);
    expect(r.commandes).toHaveLength(1);
  });

  it("lecture en échec ou réponse mal formée : erreur, jamais une liste vide inventée", async () => {
    faux.rpc.mockResolvedValue({ data: null, error: { message: "TEST_ panne" } });
    await expect(listerCommandesAdmin(TEST_AUTEUR, {}, 1)).rejects.toThrow();
    faux.rpc.mockResolvedValue({ data: { total: -1, commandes: [], chiffres: TEST_CHIFFRES }, error: null });
    await expect(listerCommandesAdmin(TEST_AUTEUR, {}, 1)).rejects.toThrow();
  });

  it("revenu payé : revenu_cents de tableau_chiffres ; échec → null (jamais un faux zéro), journalisé sans donnée", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    faux.rpc.mockResolvedValue({ data: [{ revenu_cents: 29500 }], error: null });
    expect(await lireRevenuPaye(TEST_AUTEUR)).toBe(29500);
    expect(faux.rpc).toHaveBeenCalledWith("tableau_chiffres", { p_auteur: TEST_AUTEUR });
    faux.rpc.mockResolvedValue({ data: null, error: { message: "KS_DROIT_REFUSE" } });
    expect(await lireRevenuPaye(TEST_AUTEUR)).toBeNull();
    expect(journal).toHaveBeenCalledWith("[commande] revenu payé illisible");
    journal.mockRestore();
  });

  it("page et recherche lues dans l'adresse : bornées", () => {
    expect(pageValide("3")).toBe(3);
    for (const v of [undefined, "0", "-1", "2.5", "abc", "1e3", "100001", ["x"]]) expect(pageValide(v)).toBe(1);
    expect(pageValide(["4", "5"])).toBe(4);
    expect(rechercheValide("  KS-2026  ")).toBe("KS-2026");
    expect(rechercheValide("   ")).toBeUndefined();
    expect(rechercheValide(42)).toBeUndefined();
    expect(rechercheValide("a".repeat(150))).toHaveLength(100);
    // Coupe par caractère : un emoji (deux unités UTF-16) n'est jamais coupé en deux.
    const coupee = rechercheValide("a" + "🔥".repeat(150)) ?? "";
    expect(Array.from(coupee)).toHaveLength(100);
    expect(coupee.endsWith("🔥")).toBe(true);
  });

  it("adresse de la liste : filtres et recherche gardés, page 1 omise", () => {
    expect(adresseCommandes({})).toBe("/admin/commandes");
    expect(adresseCommandes({ q: "aïcha", statut: "payee", zone: "goma" }, 2)).toBe("/admin/commandes?q=a%C3%AFcha&statut=payee&zone=goma&page=2");
    expect(adresseCommandes({ statut: "payee" }, 1)).toBe("/admin/commandes?statut=payee");
  });
});

function commande(n: number, client: CommandeAdminResume["client"] = { nom: "TEST Aïcha", emailMasque: "te***@example.invalid" }): CommandeAdminResume {
  return { numero: `KS-2026-99${String(n).padStart(4, "0")}`, creeLe: "2026-11-17T08:00:00Z", statut: "payee", totalCents: 5500, offerte: false, prestataire: "pawapay", zone: "goma", modeRemise: "livraison", client };
}

function liste(p: Partial<PageCommandesAdmin> = {}): PageCommandesAdmin {
  return { commandes: [commande(1)], total: 45, page: 1, pages: 3, chiffres: { commandesPayees: 12, tentativesReussies: 15, enAttente: 3 }, ...p };
}

describe("ListeCommandesAdmin (9.16 d)", () => {
  it("Admin : 4 cartes, dont Revenu payé", () => {
    rendre(<ListeCommandesAdmin liste={liste()} filtres={{}} revenu={29500} locale="fr" />);
    const cartes = within(screen.getByRole("region", { name: "Chiffres des commandes, depuis le début" })).getAllByRole("listitem");
    expect(cartes.map((c) => c.textContent?.replace(/\s/g, " "))).toEqual(["Revenu payé295,00 $US", "Commandes au total12", "Paiements aboutis15", "En attente3"]);
  });

  it("chiffres des cartes avec séparateur de milliers selon la langue", () => {
    const { unmount } = rendre(<ListeCommandesAdmin liste={liste({ chiffres: { commandesPayees: 12345, tentativesReussies: 1000, enAttente: 3 } })} filtres={{}} revenu={undefined} locale="en" />, "en");
    expect(screen.getByText("12,345")).toBeTruthy();
    expect(screen.getByText("1,000")).toBeTruthy();
    unmount();
    rendre(<ListeCommandesAdmin liste={liste({ chiffres: { commandesPayees: 12345, tentativesReussies: 1000, enAttente: 3 } })} filtres={{}} revenu={undefined} locale="fr" />);
    expect(screen.getByText("Commandes au total").parentElement?.textContent).toContain(new Intl.NumberFormat("fr").format(12345));
  });

  it("Assistant (revenu non lu) : 3 cartes, pas de revenu ; revenu illisible : la carte le dit", () => {
    const { unmount } = rendre(<ListeCommandesAdmin liste={liste()} filtres={{}} revenu={undefined} locale="fr" />);
    expect(screen.queryByText("Revenu payé")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Chiffres des commandes, depuis le début" })).getAllByRole("listitem")).toHaveLength(3);
    unmount();
    rendre(<ListeCommandesAdmin liste={liste()} filtres={{}} revenu={null} locale="fr" />);
    expect(screen.getByText("Revenu payé").parentElement?.textContent).toContain("Illisible");
  });

  it("pastilles : la pastille du statut courant est active (aria-current), les liens gardent la recherche et les autres filtres", () => {
    rendre(<ListeCommandesAdmin liste={liste()} filtres={{ statut: "payee", q: "ks", famille: "kit" }} revenu={undefined} locale="fr" />);
    const groupe = screen.getByRole("list", { name: "Filtrer par statut" });
    const payees = within(groupe).getByRole("link", { name: "Payées" });
    expect(payees.getAttribute("aria-current")).toBe("true");
    expect(within(groupe).getByRole("link", { name: "Toutes" }).getAttribute("aria-current")).toBeNull();
    expect(within(groupe).getByRole("link", { name: "Toutes" }).getAttribute("href")).toBe("/admin/commandes?q=ks&famille=kit");
    expect(within(groupe).getByRole("link", { name: "Échouées" }).getAttribute("href")).toBe("/admin/commandes?q=ks&statut=echouee&famille=kit");
    expect(within(groupe).getAllByRole("link").map((l) => l.textContent)).toEqual(["Toutes", "Payées", "Échouées", "En attente", "Remboursées"]);
  });

  it("sans statut : TOUTES active ; recherche reliée au formulaire GET avec sa valeur", () => {
    rendre(<ListeCommandesAdmin liste={liste()} filtres={{ q: "KS-2026-0001" }} revenu={undefined} locale="fr" />);
    expect(screen.getByRole("link", { name: "Toutes" }).getAttribute("aria-current")).toBe("true");
    const champ = screen.getByRole("searchbox", { name: "Rechercher par numéro ou client" }) as HTMLInputElement;
    expect(champ.value).toBe("KS-2026-0001");
    expect(champ.name).toBe("q");
    const formulaire = screen.getByRole("form", { name: "Filtres des commandes" }) as HTMLFormElement;
    expect(formulaire.method).toBe("get");
    expect(champ.form).toBe(formulaire);
  });

  it("45 commandes : « Page 1 / 3 », ‹ désactivé sur la première, › vers la page 2 avec les filtres", () => {
    rendre(<ListeCommandesAdmin liste={liste()} filtres={{ statut: "payee" }} revenu={undefined} locale="fr" />);
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByText("Page 1 / 3")).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Page précédente" }).getAttribute("aria-disabled")).toBe("true");
    expect(within(nav).getByRole("link", { name: "Page suivante" }).getAttribute("href")).toBe("/admin/commandes?statut=payee&page=2");
  });

  it("colonne Client : avatar et nom ; sans nom, l'email masqué seul (jamais de nom inventé) ; colonnes de la maquette plus Remise", () => {
    const { container } = rendre(
      <ListeCommandesAdmin liste={liste({ commandes: [commande(1), commande(2, { nom: null, emailMasque: "zz***@example.invalid" })], total: 2, pages: 1 })} filtres={{}} revenu={undefined} locale="fr" />,
    );
    const tableau = screen.getByRole("table");
    expect(within(tableau).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["N° commande", "Client", "Date", "Paiement", "Montant", "Statut", "Remise"]);
    const lignes = within(tableau).getAllByRole("row").slice(1);
    expect(lignes[0].textContent).toContain("TEST Aïcha");
    expect(lignes[0].querySelector('[aria-hidden="true"]')?.textContent).toBe("T");
    expect(lignes[1].textContent).toContain("zz***@example.invalid");
    expect(lignes[1].querySelector("span.size-\\[52px\\]")).toBeNull();
    expect(within(lignes[0]).getByRole("link", { name: "KS-2026-990001" }).getAttribute("href")).toBe("/admin/commandes/KS-2026-990001");
    expect(lignes[0].textContent).toContain("PawaPay");
    // Une seule page : pas de pagination.
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
    expect(container.textContent).not.toMatch(/[a-z0-9]{3,}@example\.invalid/);
  });

  it("commande offerte : « Offerte » dans Paiement ; liste vide : message", () => {
    const { unmount } = rendre(<ListeCommandesAdmin liste={liste({ commandes: [{ ...commande(3), offerte: true, prestataire: null, statut: "offerte", totalCents: 0 }], total: 1, pages: 1 })} filtres={{}} revenu={undefined} locale="fr" />);
    expect(within(screen.getByRole("table")).getAllByRole("row")[1].textContent).toContain("Offerte");
    unmount();
    rendre(<ListeCommandesAdmin liste={liste({ commandes: [], total: 0, pages: 1 })} filtres={{ q: "rien" }} revenu={undefined} locale="fr" />);
    expect(screen.getByText("Aucune commande ne correspond à ces filtres ou à cette recherche.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Effacer les filtres" })).toBeTruthy();
  });
});
