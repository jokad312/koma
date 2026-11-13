// @vitest-environment jsdom
import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ univers: vi.fn(), etat: "anonyme" as string }));
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
vi.mock("@/lib/auth/compte", () => ({ lireEtatCompte: async () => faux.etat }));
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

async function rendreInterne(locale: "fr" | "en", requete: Record<string, string> = {}) {
  const page = await Connexion({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(requete) } as never);
  const suspense = trouver(page, (await import("react")).Suspense)!;
  const interne = (suspense.props as { children: ReactElement }).children;
  return (interne.type as (p: unknown) => Promise<ReactElement>)(interne.props);
}

async function formulaire(locale: "fr" | "en") {
  const rendu = await rendreInterne(locale);
  // Sous Suspense : éventuel message « session expirée », puis le formulaire.
  const form = trouver(rendu, FormulaireConnexion);
  expect(form).not.toBeNull();
  return form!.props as { univers: unknown; etapeInitiale: string };
}

beforeEach(() => {
  vi.clearAllMocks();
  faux.etat = "anonyme";
  faux.univers.mockResolvedValue([]);
});

// Cherche un élément <p role="status"> dans l'arbre rendu.
function messageStatut(noeud: unknown): ReactElement | null {
  if (Array.isArray(noeud)) return noeud.map(messageStatut).find(Boolean) ?? null;
  if (!isValidElement(noeud)) return null;
  const props = noeud.props as { role?: string; children?: unknown };
  if (props.role === "status") return noeud;
  return messageStatut(props.children);
}

describe("page /connexion : message de session expirée (story 9.14)", () => {
  it("expiree=1 : message en role=status", async () => {
    const statut = messageStatut(await rendreInterne("fr", { expiree: "1" }));
    expect(statut).not.toBeNull();
    expect((statut!.props as { children: unknown }).children).toBe("sessionExpiree");
  });
  it("sans expiree : aucun message", async () => {
    expect(messageStatut(await rendreInterne("fr"))).toBeNull();
  });
  it("personne encore connectée (Compte incomplet ou questions) : aucun message", async () => {
    for (const etat of ["incomplet", "questions"]) {
      faux.etat = etat;
      expect(messageStatut(await rendreInterne("fr", { expiree: "1" }))).toBeNull();
    }
  });
});

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
