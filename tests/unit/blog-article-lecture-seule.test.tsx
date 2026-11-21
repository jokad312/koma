// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({
  getTranslations: async (espace: string) => (await import("next-intl")).createTranslator({ locale: "fr", messages: fr, namespace: espace as "Admin.blog" }),
  getFormatter: async () => (await import("next-intl")).createFormatter({ locale: "fr" }),
}));

import { ArticleLectureSeule } from "@/components/admin/ArticleLectureSeule";
import type { Article } from "@/modules/blog/types";

const ARTICLE: Article = {
  id: "00000000-0000-4000-8000-0000000000b1",
  auteurId: "00000000-0000-4000-8000-0000000000b2",
  titreFr: "TEST_ Guide",
  titreEn: null,
  texteFr: "## Matériel\nTEST_ mousse EVA",
  texteEn: null,
  extraitFr: null,
  extraitEn: null,
  slug: "test-guide",
  lienProduitId: "00000000-0000-4000-8000-0000000000b3",
  images: [{ fichier: "articles/test.jpg", altFr: "TEST_ texte alternatif", altEn: "TEST_ alt" }],
  publieLe: "2026-11-20T10:00:00Z",
  creeLe: "2026-11-19T10:00:00Z",
  modifieLe: "2026-11-20T10:00:00Z",
  archiveLe: null,
};

describe("article en lecture seule pour l'Assistant (point 3)", () => {
  it("aucun champ ni bouton ; statut, titre et texte affichés tels quels ; une valeur absente le dit", async () => {
    const { container } = rendre(await ArticleLectureSeule({ article: ARTICLE }));
    expect(container.querySelectorAll("input, textarea, select, button, form")).toHaveLength(0);
    expect(screen.getByRole("note").textContent).toBe(fr.Admin.blog.lecture.note);
    expect(screen.getByText("Publié")).toBeTruthy();
    expect(screen.getByText("TEST_ Guide")).toBeTruthy();
    expect(screen.getByText(/## Matériel/)).toBeTruthy();
    expect(screen.getAllByText("Non renseigné").length).toBeGreaterThan(0);
    // Adresse, images (textes alternatifs) et produit lié : rien de l'existant n'est retiré.
    expect(screen.getByText("test-guide")).toBeTruthy();
    expect(screen.getByText("TEST_ texte alternatif")).toBeTruthy();
    expect(screen.getByText(fr.Admin.blog.lecture.produitOui)).toBeTruthy();
  });

  it("article archivé : statut « Archivé »", async () => {
    rendre(await ArticleLectureSeule({ article: { ...ARTICLE, archiveLe: "2026-11-21T10:00:00Z", publieLe: null } }));
    expect(screen.getByText("Archivé")).toBeTruthy();
  });
});
