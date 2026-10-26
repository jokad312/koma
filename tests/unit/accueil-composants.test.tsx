// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

vi.mock("server-only", () => ({}));
const faux = vi.hoisted(() => ({ messages: null as unknown, lire: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: (faux.messages as Record<string, never>) ?? {}, namespace: namespace as never }),
  };
});
vi.mock("@/modules/accueil/cosplays-recents", () => ({ lireCosplaysRecents: faux.lire }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ) }));
vi.mock("@/lib/seo/url", () => ({ urlLocalisee: (locale: string) => `https://exemple.test/${locale}` }));
vi.mock("@/components/ui/TitreVitrine", () => ({
  TitreVitrine: ({ niveau, children }: { niveau: 1 | 2; children: string }) => (niveau === 1 ? <h1>{children}</h1> : <h2>{children}</h2>),
}));

import { BlocCosplaysRecents } from "@/components/accueil/BlocCosplaysRecents";
import { BlocFaqCourte } from "@/components/accueil/BlocFaqCourte";
import { TuilesCategories } from "@/components/accueil/TuilesCategories";

const MARQUEUR = "[Texte à fournir]";
const toutes = { fr, en };

function carte(i: number) {
  return { id: `TEST_${i}`, slug: `test-${i}`, famille: "cosplay", titre: `Cosplay de test ${i}`, photoAlt: `Alt de test ${i}`, photoUrl: `https://exemple.test/p${i}.jpg`, prixCents: 1000, disponibilite: "disponible" };
}

beforeEach(() => {
  faux.messages = fr;
  faux.lire.mockReset();
});

describe("BlocCosplaysRecents", () => {
  it("liste vide : rien n'est rendu", async () => {
    faux.lire.mockResolvedValue([]);
    const { container } = rendre(<>{await BlocCosplaysRecents({ locale: "fr" })}</>);
    expect(container.textContent).toBe("");
    expect(screen.queryByRole("heading")).toBeNull();
  });

  for (const langue of ["fr", "en"] as const) {
    it(`${langue} : 4 cartes, un h2 et le lien vers le catalogue de la langue`, async () => {
      faux.messages = toutes[langue];
      faux.lire.mockResolvedValue([1, 2, 3, 4].map(carte));
      const { container } = rendre(<>{await BlocCosplaysRecents({ locale: langue })}</>, langue);
      expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
      expect(container.querySelectorAll("ul > li")).toHaveLength(4);
      const lien = screen.getByRole("link", { name: langue === "fr" ? "Voir tous les cosplays" : "See all cosplays" });
      expect(lien.getAttribute("href")).toBe("/cosplays");
    });
  }
});

describe("BlocFaqCourte", () => {
  const jsonLd = (c: HTMLElement) => Array.from(c.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent ?? "");

  it("tout au marqueur : trois questions rendues, aucun JSON-LD", async () => {
    const { container } = rendre(await BlocFaqCourte({ locale: "fr" }));
    expect(container.querySelectorAll("details")).toHaveLength(3);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(jsonLd(container)).toEqual([]);
  });

  it("paires réelles : FAQPage présent, sans aucune occurrence du marqueur", async () => {
    const reel = structuredClone(fr) as typeof fr;
    const q = reel.Faq.questions;
    q.paiement.question = "Question de test 1 ?";
    q.paiement.reponse = "Réponse de test 1.";
    q.livraison.question = "Question de test 2 ?";
    q.livraison.reponse = "Réponse de test 2.";
    // « delais » garde le marqueur : sa paire est exclue du JSON-LD mais reste affichée.
    faux.messages = reel;
    const { container } = rendre(await BlocFaqCourte({ locale: "fr" }));
    expect(container.querySelectorAll("details")).toHaveLength(3);
    const blocs = jsonLd(container);
    expect(blocs).toHaveLength(1);
    const donnees = JSON.parse(blocs[0]);
    expect(donnees["@type"]).toBe("FAQPage");
    expect(donnees.mainEntity).toHaveLength(2);
    expect(blocs[0]).not.toContain(MARQUEUR);
  });
});

describe("TuilesCategories", () => {
  for (const langue of ["fr", "en"] as const) {
    it(`${langue} : liens vers les catalogues de la langue et un seul h2`, () => {
      rendre(<TuilesCategories />, langue);
      expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
      const liens = within(screen.getByRole("list")).getAllByRole("link");
      expect(liens.map((l) => l.getAttribute("href"))).toEqual(["/cosplays", langue === "fr" ? "/accessoires" : "/accessories"]);
    });
  }
});

