// @vitest-environment jsdom
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ chargerPlus: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/evenements/voir-plus", () => ({ chargerPlusEvenements: (...a: unknown[]) => faux.chargerPlus(...a) }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/festival",
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

import { ListeEvenements } from "@/components/festival/ListeEvenements";
import type { CarteEvenement } from "@/modules/evenements/types";

function evenement(n: number, passe: boolean): CarteEvenement {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    slug: `test-evenement-${n}`,
    titre: `TEST_Titre ${n}`,
    debutLe: passe ? "2020-05-01T08:00:00+00:00" : "2099-05-01T08:00:00+00:00",
    lieu: "TEST_Lieu",
    vignetteUrl: null,
    vignetteAlt: null,
    passe,
    venteAVenir: false,
  };
}

beforeEach(() => {
  faux.chargerPlus.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("ListeEvenements", () => {
  it("à venir puis passés : deux sections en H2, cartes en H3, lien « Voir plus » portant le nombre déjà montré", () => {
    const liste = [evenement(1, false), evenement(2, false), evenement(3, true)];
    rendre(<ListeEvenements evenements={liste} suite={12} cle="debut|1" />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    const titres = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titres).toEqual(["TEST_Titre 1", "TEST_Titre 2", "TEST_Titre 3"]);
    expect(screen.getByRole("link", { name: "Voir plus" }).getAttribute("href")).toBe("/festival?affiches=12");
  });

  it("sans Événement à venir : « Aucun événement à venir pour le moment. » et les passés restent affichés", () => {
    rendre(<ListeEvenements evenements={[evenement(1, true)]} suite={null} cle="debut|1" />);
    expect(screen.getByText("Aucun événement à venir pour le moment.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "TEST_Titre 1" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Voir plus" })).toBeNull();
  });

  it("aucun Événement du tout : le message seul, rien d'inventé", () => {
    rendre(<ListeEvenements evenements={[]} suite={null} cle="debut|aucun" />);
    expect(screen.getByText("Aucun événement à venir pour le moment.")).toBeTruthy();
    expect(screen.queryAllByRole("heading")).toHaveLength(0);
  });

  it("« Voir plus » ajoute les suivants, réécrit l'adresse et place le focus sur la première carte ajoutée", async () => {
    faux.chargerPlus.mockResolvedValue({ ok: true, evenements: [evenement(13, true)], suite: null });
    rendre(<ListeEvenements evenements={[evenement(1, false)]} suite={12} cle="debut|1" />);
    await userEvent.click(screen.getByRole("link", { name: "Voir plus" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 3, name: "TEST_Titre 13" })).toBeTruthy());
    expect(faux.chargerPlus).toHaveBeenCalledWith(12, "fr");
    expect(window.location.search).toBe("?affiches=12");
    expect(screen.queryByRole("link", { name: "Voir plus" })).toBeNull();
    expect(document.activeElement?.textContent).toBe("TEST_Titre 13");
  });

  it("erreur de « Voir plus » : le message d'erreur s'affiche et le lien reste", async () => {
    faux.chargerPlus.mockResolvedValue({ ok: false });
    rendre(<ListeEvenements evenements={[evenement(1, false)]} suite={12} cle="debut|1" />);
    await act(async () => {
      await userEvent.click(screen.getByRole("link", { name: "Voir plus" }));
    });
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("link", { name: "Voir plus" })).toBeTruthy();
  });
});
