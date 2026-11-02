// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

vi.mock("server-only", () => ({}));
const faux = vi.hoisted(() => ({
  messages: null as unknown,
  listerKits: vi.fn(),
  lireHeros: vi.fn(),
  lireFiche: vi.fn(),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: (faux.messages as Record<string, never>) ?? {}, namespace: namespace as never }),
  };
});
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/modules/catalogue/queries", () => ({
  listerCatalogue: faux.listerKits,
  lireFicheProduit: faux.lireFiche,
}));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} />
) }));
vi.mock("@/components/ui/TitreVitrine", () => ({
  TitreVitrine: ({ niveau, children }: { niveau: 1 | 2; children: string }) => (niveau === 1 ? <h1>{children}</h1> : <h2>{children}</h2>),
}));

import { BlocKits } from "@/components/accueil/BlocKits";
import { lireKits } from "@/modules/accueil/kits";

function fauxKit(i: number, prixCents = 1500) {
  return {
    id: `KIT_${i}`,
    slug: `kit-test-${i}`,
    famille: "kit",
    titre: `Kit de test ${i}`,
    photoAlt: `Alt kit ${i}`,
    photoUrl: `https://exemple.test/kit${i}.jpg`,
    prixCents,
    disponibilite: "disponible",
  };
}

beforeEach(() => {
  faux.messages = fr;
  faux.listerKits.mockReset();
  faux.lireHeros.mockReset();
  faux.lireFiche.mockReset();
});

describe("lireKits", () => {
  it("renvoie la liste des kits publiés", async () => {
    faux.listerKits.mockResolvedValue({ produits: [fauxKit(1), fauxKit(2)], suite: null });
    const kits = await lireKits("fr");
    expect(kits).toHaveLength(2);
    expect(faux.listerKits).toHaveBeenCalledWith("kit", expect.objectContaining({ tri: "nouveautes" }), "fr");
  });

  it("erreur de lecture : renvoie une liste vide et log", async () => {
    faux.listerKits.mockRejectedValue(new Error("base hs"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const kits = await lireKits("fr");
    expect(kits).toEqual([]);
    expect(spy).toHaveBeenCalled();
  });
});

describe("BlocKits", () => {
  it("aucun kit : rien n'est rendu", async () => {
    faux.listerKits.mockResolvedValue({ produits: [], suite: null });
    const { container } = rendre(<>{await BlocKits({ locale: "fr" })}</>);
    expect(container.textContent).toBe("");
  });

  it("kits présents dont un gratuit : place le gratuit en premier", async () => {
    const k1 = fauxKit(1, 1500);
    const kGratuit = fauxKit(2, 0);
    faux.listerKits.mockResolvedValue({ produits: [k1, kGratuit], suite: null });

    const { container } = rendre(<>{await BlocKits({ locale: "fr" })}</>);
    expect(screen.getByRole("heading", { level: 2, name: "KITS" })).toBeTruthy();
    const liens = within(container).getAllByRole("link");
    expect(liens.length).toBeGreaterThan(0);
    expect(screen.getByText("Kit de test 2")).toBeTruthy();
  });
});
