// @vitest-environment jsdom
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ chargerPlus: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/blog/voir-plus", () => ({ chargerPlusArticles: (...a: unknown[]) => faux.chargerPlus(...a) }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/blog",
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { ListeArticles } from "@/components/blog/ListeArticles";
import type { CarteArticle } from "@/modules/blog/types";

const DATE = "2026-10-26T10:00:00+00:00";
const CURSEUR = "CUR1";

function article(n: number, surcharge: Partial<CarteArticle> = {}): CarteArticle {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    slug: `test-article-${n}`,
    titre: `TEST_Titre ${n}`,
    publieLe: DATE,
    vignetteUrl: null,
    vignetteAlt: null,
    ...surcharge,
  };
}

const initiaux = Array.from({ length: 12 }, (_, i) => article(i + 1));

beforeEach(() => {
  faux.chargerPlus.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("ListeArticles et « Voir plus »", () => {
  it("12 cartes en h2 et un vrai lien « Voir plus » portant le curseur", () => {
    rendre(<ListeArticles articles={initiaux} suite={CURSEUR} cle="debut|1" />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(12);
    expect(screen.getByRole("link", { name: "Voir plus" }).getAttribute("href")).toBe(`/blog?curseur=${CURSEUR}`);
  });

  it("dernière page : aucun « Voir plus »", () => {
    rendre(<ListeArticles articles={initiaux.slice(0, 3)} suite={null} cle="debut|1" />);
    expect(screen.queryByRole("link", { name: "Voir plus" })).toBeNull();
  });

  it("avec JavaScript : ajoute 12 Articles, met l'adresse à jour, place le focus sur le premier ajouté", async () => {
    const user = userEvent.setup();
    const suivants = Array.from({ length: 12 }, (_, i) => article(i + 13));
    faux.chargerPlus.mockResolvedValue({ ok: true, articles: [...initiaux, ...suivants], suite: "CUR2" });
    rendre(<ListeArticles articles={initiaux} suite={CURSEUR} cle="debut|1" />);

    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(24));
    expect(faux.chargerPlus).toHaveBeenCalledWith(CURSEUR, "fr");
    expect(window.location.pathname + window.location.search).toBe(`/fr/blog?curseur=${CURSEUR}`);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("link", { name: "TEST_Titre 13" })));
    expect(screen.getByRole("link", { name: "Voir plus" }).getAttribute("href")).toBe("/blog?curseur=CUR2");
  });

  it("chargement en cours : le lien reste, son texte devient « Chargement… »", async () => {
    const user = userEvent.setup();
    let finir: (v: unknown) => void = () => {};
    faux.chargerPlus.mockImplementation(() => new Promise((resolve) => (finir = resolve)));
    rendre(<ListeArticles articles={initiaux} suite={CURSEUR} cle="debut|1" />);

    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    expect(screen.getByText("Chargement…")).toBeTruthy();
    await act(async () => finir({ ok: true, articles: initiaux, suite: null }));
  });

  it("échec : alerte, liste inchangée, lien toujours utilisable", async () => {
    const user = userEvent.setup();
    faux.chargerPlus.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, articles: [...initiaux, article(13)], suite: null });
    rendre(<ListeArticles articles={initiaux} suite={CURSEUR} cle="debut|1" />);

    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Impossible de charger la suite");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(12);

    await user.click(screen.getByRole("link", { name: "Voir plus" }));
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(13));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("un clic avec Ctrl n'est pas intercepté (ouvre le lien normalement)", async () => {
    const user = userEvent.setup();
    rendre(<ListeArticles articles={initiaux} suite={CURSEUR} cle="debut|1" />);
    const lien = screen.getByRole("link", { name: "Voir plus" });
    lien.addEventListener("click", (e) => e.preventDefault());
    await user.keyboard("{Control>}");
    await act(async () => {
      await user.click(lien);
    });
    await user.keyboard("{/Control}");
    expect(faux.chargerPlus).not.toHaveBeenCalled();
  });
});
