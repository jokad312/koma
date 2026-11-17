// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

// Story 9.16 g) : liste du blog selon la maquette 05-blog (CB1 à CB10), filtres (Q26/Q27), corbeille = archivage (Q22).
const faux = vi.hoisted(() => ({
  archiverArticleAction: vi.fn(),
  restaurerArticleAction: vi.fn(),
  publierArticleAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/blog/actions", () => ({
  archiverArticleAction: (...a: unknown[]) => faux.archiverArticleAction(...a),
  restaurerArticleAction: (...a: unknown[]) => faux.restaurerArticleAction(...a),
  publierArticleAction: (...a: unknown[]) => faux.publierArticleAction(...a),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: faux.refresh }),
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { ListeArticles } from "@/components/admin/ListeArticles";
import type { ArticleListe } from "@/modules/blog/types";

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/fr/admin/blog");
});
afterEach(() => vi.restoreAllMocks());

const base = { slug: "test", publieLe: null, archiveLe: null, vignette: null, extrait: null, modifieLe: "2026-11-14T10:00:00Z" } as const;
const ARTICLES: ArticleListe[] = [
  { ...base, id: "TEST_p", titreFr: "TEST_Publie", publieLe: "2026-11-14T10:00:00Z", vignette: { url: "https://test.invalid/a.jpg", alt: "TEST_alt" }, extrait: "TEST_ extrait" },
  { ...base, id: "TEST_b", titreFr: "TEST_Brouillon" },
  { ...base, id: "TEST_a", titreFr: "TEST_Archive", archiveLe: "2026-11-15T00:00:00Z" },
];

const carte = (titre: string) => screen.getByRole("heading", { level: 2, name: titre }).closest("li") as HTMLElement;
const compteur = () => screen.getAllByRole("status")[1];

describe("ListeArticles (9.16 g)", () => {
  it("ÉCRIRE UN ARTICLE, compteur annoncé, 4 filtres aria-pressed, grille de 1 colonne puis 2 ; archivés hors de « Tous »", () => {
    rendre(<ListeArticles articles={ARTICLES} filtreInitial="tous" peutPublier />);
    expect(screen.getByRole("link", { name: "Écrire un article" }).getAttribute("href")).toBe("/admin/blog/nouveau");
    expect(compteur().textContent).toBe("2 articles");
    const filtres = within(screen.getByRole("list", { name: "Afficher les articles" })).getAllByRole("button");
    expect(filtres.map((b) => b.textContent)).toEqual(["Tous", "Publiés", "Brouillons", "Archivés"]);
    expect(filtres.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false", "false"]);
    const grille = screen.getByRole("list", { name: "Liste des articles" });
    expect(grille.className).toContain("grid-cols-1");
    expect(grille.className).toContain("xl:grid-cols-2");
    expect(screen.queryByRole("heading", { name: "TEST_Archive" })).toBeNull();
  });

  it("carte publiée : image et texte alternatif, PUBLIÉ, date courte, extrait, crayon, Dépublier, Archiver ; pas de Publier", () => {
    rendre(<ListeArticles articles={ARTICLES} filtreInitial="tous" peutPublier />);
    const c = carte("TEST_Publie");
    expect(within(c).getByRole("img", { name: "TEST_alt" }).getAttribute("src")).toBe("https://test.invalid/a.jpg");
    expect(within(c).getByText("Publié")).toBeTruthy();
    expect(within(c).getByText("TEST_ extrait")).toBeTruthy();
    expect(c.querySelector("time")?.textContent).toMatch(/14 nov\./);
    expect(within(c).getByRole("link", { name: "Modifier TEST_Publie" }).getAttribute("href")).toBe("/admin/blog/TEST_p");
    expect(within(c).getByRole("button", { name: "Dépublier TEST_Publie" })).toBeTruthy();
    expect(within(c).getByRole("button", { name: "Archiver TEST_Publie" })).toBeTruthy();
    expect(within(c).queryByRole("button", { name: "Publier TEST_Publie" })).toBeNull();
  });

  it("carte brouillon : icône image sans image inventée, BROUILLON, Publier, pas de Dépublier", () => {
    rendre(<ListeArticles articles={ARTICLES} filtreInitial="tous" peutPublier />);
    const c = carte("TEST_Brouillon");
    expect(within(c).queryByRole("img")).toBeNull();
    expect(within(c).getByText("Pas d'image")).toBeTruthy();
    expect(within(c).getByText("Brouillon")).toBeTruthy();
    expect(within(c).getByRole("button", { name: "Publier TEST_Brouillon" })).toBeTruthy();
    expect(within(c).queryByRole("button", { name: /Dépublier/ })).toBeNull();
  });

  it("filtres : Publiés, Brouillons, Archivés ; le filtre passe dans l'adresse ; messages vides propres", async () => {
    const user = userEvent.setup();
    rendre(<ListeArticles articles={ARTICLES} filtreInitial="tous" peutPublier />);
    await user.click(screen.getByRole("button", { name: "Publiés" }));
    expect(screen.getByRole("button", { name: "Publiés" }).getAttribute("aria-pressed")).toBe("true");
    expect(window.location.search).toBe("?filtre=publies");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["TEST_Publie"]);
    await user.click(screen.getByRole("button", { name: "Brouillons" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["TEST_Brouillon"]);
    await user.click(screen.getByRole("button", { name: "Archivés" }));
    const archive = carte("TEST_Archive");
    expect(within(archive).getByText("Archivé")).toBeTruthy();
    expect(within(archive).getByRole("button", { name: "Restaurer TEST_Archive" })).toBeTruthy();
    expect(within(archive).queryByRole("button", { name: /Publier|Archiver/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tous" }));
    expect(window.location.search).toBe("");
  });

  it("filtre initial venu de l'adresse ; aucun article dans la vue : message", () => {
    rendre(<ListeArticles articles={ARTICLES.slice(0, 1)} filtreInitial="archives" peutPublier />);
    expect(screen.getByRole("button", { name: "Archivés" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Aucun article archivé.")).toBeTruthy();
    expect(compteur().textContent).toBe("Aucun article");
  });

  it("archiver : confirmation, action réelle, annonce et focus sur le compteur", async () => {
    faux.archiverArticleAction.mockResolvedValue({ statut: "succes" });
    const user = userEvent.setup();
    rendre(<ListeArticles articles={ARTICLES} filtreInitial="tous" peutPublier />);
    await user.click(within(carte("TEST_Publie")).getByRole("button", { name: "Archiver TEST_Publie" }));
    expect(faux.archiverArticleAction).not.toHaveBeenCalled();
    const dialogue = screen.getByRole("dialog", { name: "Archiver « TEST_Publie » ?" });
    await user.click(within(dialogue).getByRole("button", { name: "Archiver" }));
    await waitFor(() => expect(faux.archiverArticleAction).toHaveBeenCalledWith({ id: "TEST_p" }));
    await waitFor(() => expect(screen.getByText("Article archivé.")).toBeTruthy());
    expect(faux.refresh).toHaveBeenCalled();
    expect(document.activeElement).toBe(compteur());
  });

  it("dépublier et restaurer sans confirmation ; refus de publication : message et lien pour compléter", async () => {
    faux.publierArticleAction.mockResolvedValueOnce({ statut: "succes", id: "TEST_p", cree: false });
    faux.publierArticleAction.mockResolvedValueOnce({ statut: "erreur", erreur: "publication_incomplete" });
    faux.restaurerArticleAction.mockResolvedValue({ statut: "succes" });
    const user = userEvent.setup();
    rendre(<ListeArticles articles={ARTICLES} filtreInitial="tous" peutPublier />);
    await user.click(screen.getByRole("button", { name: "Dépublier TEST_Publie" }));
    await waitFor(() => expect(faux.publierArticleAction).toHaveBeenCalledWith({ id: "TEST_p", publier: false }));
    await user.click(screen.getByRole("button", { name: "Publier TEST_Brouillon" }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("Il manque des éléments pour publier");
    expect(within(alerte).getByRole("link", { name: "Compléter « TEST_Brouillon »" }).getAttribute("href")).toBe("/admin/blog/TEST_b");
    await user.click(screen.getByRole("button", { name: "Archivés" }));
    await user.click(screen.getByRole("button", { name: "Restaurer TEST_Archive" }));
    await waitFor(() => expect(faux.restaurerArticleAction).toHaveBeenCalledWith({ id: "TEST_a" }));
  });

  it("sans le rôle Admin (Assistant) : crayon seulement, ni Publier, ni Dépublier, ni Archiver, ni Restaurer", async () => {
    const user = userEvent.setup();
    rendre(<ListeArticles articles={ARTICLES} filtreInitial="tous" peutPublier={false} />);
    expect(within(carte("TEST_Publie")).getByRole("link", { name: "Modifier TEST_Publie" })).toBeTruthy();
    expect(within(carte("TEST_Publie")).queryAllByRole("button")).toHaveLength(0);
    expect(within(carte("TEST_Brouillon")).queryAllByRole("button")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Archivés" }));
    expect(within(carte("TEST_Archive")).queryAllByRole("button")).toHaveLength(0);
  });

  it("annonce : effacée au début de chaque action et au changement de filtre ; focus inchangé après Dépublier", async () => {
    faux.publierArticleAction.mockResolvedValue({ statut: "succes", id: "TEST_p", cree: false });
    faux.archiverArticleAction.mockResolvedValue({ statut: "succes" });
    const user = userEvent.setup();
    rendre(<ListeArticles articles={ARTICLES} filtreInitial="tous" peutPublier />);
    const annonce = () => screen.getAllByRole("status")[0];
    const depublier = screen.getByRole("button", { name: "Dépublier TEST_Publie" });
    await user.click(depublier);
    await waitFor(() => expect(annonce().textContent).toBe("Article dépublié : il n'est plus visible sur le site."));
    expect(document.activeElement).not.toBe(compteur());
    await user.click(screen.getByRole("button", { name: "Brouillons" }));
    expect(annonce().textContent).toBe("");
    await user.click(screen.getByRole("button", { name: "Tous" }));
    // Deux archivages de suite : l'annonce est vidée au début du second, puis réécrite (relue par les lecteurs d'écran).
    await user.click(screen.getByRole("button", { name: "Archiver TEST_Publie" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Archiver" }));
    await waitFor(() => expect(annonce().textContent).toBe("Article archivé."));
    let resoudre: (v: unknown) => void = () => {};
    faux.archiverArticleAction.mockImplementationOnce(() => new Promise((r) => (resoudre = r)));
    await user.click(screen.getByRole("button", { name: "Archiver TEST_Brouillon" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Archiver" }));
    await waitFor(() => expect(annonce().textContent).toBe(""));
    resoudre({ statut: "succes" });
    await waitFor(() => expect(annonce().textContent).toBe("Article archivé."));
    expect(document.activeElement).toBe(compteur());
  });

  it("aucun article : état vide et bouton de rédaction", () => {
    rendre(<ListeArticles articles={[]} filtreInitial="tous" peutPublier />);
    expect(screen.getByRole("status").textContent).toBe("Aucun article pour le moment.");
    expect(screen.getByRole("link", { name: "Écrire le premier article" })).toBeTruthy();
  });
});
