// @vitest-environment jsdom
import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ univers: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "TEST" }) }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: () => {
    throw new Error("redirect");
  },
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k, setRequestLocale: () => {} }));
vi.mock("@/lib/auth/compte", () => ({ lireEtatCompte: async () => "visiteur" }));
vi.mock("@/lib/reglages", () => ({ lireNomSite: async () => "TEST" }));
vi.mock("@/lib/seo/url", () => ({ urlLocalisee: () => "http://test" }));
vi.mock("@/modules/catalogue/queries", () => ({ lireUniversPublics: (...a: unknown[]) => faux.univers(...a) }));

import Connexion from "../../src/app/[locale]/connexion/page";
import { FormulaireConnexion } from "../../src/app/[locale]/connexion/FormulaireConnexion";

// Descend l'arbre d'éléments React rendu par la page jusqu'au composant interne (sous Suspense), l'exécute, et renvoie l'élément FormulaireConnexion.
function trouver(noeud: unknown, type: unknown): ReactElement | null {
  if (!isValidElement(noeud)) return Array.isArray(noeud) ? (noeud.map((n) => trouver(n, type)).find(Boolean) ?? null) : null;
  if (noeud.type === type) return noeud;
  return trouver((noeud.props as { children?: unknown }).children, type);
}

async function formulaire(locale: "fr" | "en") {
  const page = await Connexion({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) } as never);
  const suspense = trouver(page, (await import("react")).Suspense)!;
  const interne = (suspense.props as { children: ReactElement }).children;
  const rendu = await (interne.type as (p: unknown) => Promise<ReactElement>)(interne.props);
  expect(rendu.type).toBe(FormulaireConnexion);
  return rendu.props as { univers: unknown; etapeInitiale: string };
}

beforeEach(() => vi.clearAllMocks());

describe("page /connexion : univers de la question d'accueil", () => {
  it("les univers lus dans la langue de la route sont passés au formulaire", async () => {
    faux.univers.mockResolvedValue([{ id: "TEST_1", nom: "Test universe" }]);
    const props = await formulaire("en");
    expect(faux.univers).toHaveBeenCalledWith("en");
    expect(props).toMatchObject({ univers: [{ id: "TEST_1", nom: "Test universe" }], etapeInitiale: "email" });
  });

  it("lecture impossible : le formulaire s'affiche quand même, sans univers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    faux.univers.mockRejectedValue(new Error("TEST_lecture"));
    expect((await formulaire("fr")).univers).toEqual([]);
  });
});
