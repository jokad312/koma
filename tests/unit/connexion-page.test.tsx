// @vitest-environment jsdom
import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({
  photos: vi.fn(async (): Promise<string[]> => []), univers: vi.fn(), etat: "anonyme" as string }));
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
vi.mock("@/lib/vitrine/photos-connexion", () => ({ lirePhotosConnexion: () => faux.photos() }));

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

// Panneau de gauche (point 1 puis 9.17). Sans image : le mot « COSPLAY », décoratif (aria-hidden). Avec des images : le diaporama, avec son
// texte alternatif, lue par les lecteurs d'écran.
describe("panneau de la page de connexion", () => {
  function panneau(page: ReactElement): ReactElement {
    const chercher = (n: unknown): ReactElement | null => {
      if (Array.isArray(n)) return n.map(chercher).find(Boolean) ?? null;
      if (!isValidElement(n)) return null;
      const props = n.props as Record<string, unknown>;
      if ("data-panneau-connexion" in props) return n;
      return chercher(props.children);
    };
    return chercher(page)!;
  }

  it("sans photo : le mot géant, panneau décoratif (aria-hidden)", async () => {
    faux.photos.mockResolvedValueOnce([]);
    const page = (await Connexion({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve({}) } as never)) as ReactElement;
    const p = panneau(page);
    expect((p.props as { "aria-hidden"?: boolean })["aria-hidden"]).toBe(true);
    const enfant = (p.props as { children: ReactElement }).children;
    expect((enfant.props as Record<string, unknown>)["data-mot-connexion"]).toBe("");
    expect((enfant.props as { children: string }).children).toBe("panneau.mot");
  });

  it("avec des images (9.17) : le diaporama reçoit toutes les images dans l'ordre ; en-tête réduit ; marqueur qui retire l'en-tête et le pied du site", async () => {
    faux.photos.mockResolvedValueOnce(["/images/connexion/1-illustration.webp", "/images/connexion/2-illustration.webp"]);
    const page = (await Connexion({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve({}) } as never)) as ReactElement;
    expect((page.props as Record<string, unknown>)["data-page-connexion"]).toBe("");
    const p = panneau(page);
    expect((p.props as { "aria-hidden"?: boolean })["aria-hidden"]).toBeUndefined();
    const diaporama = (p.props as { children: ReactElement }).children;
    expect((diaporama.type as { name?: string }).name).toBe("DiaporamaConnexion");
    expect(diaporama.props).toEqual({ images: ["/images/connexion/1-illustration.webp", "/images/connexion/2-illustration.webp"] });
    const entete = (page.props as { children: ReactElement[] }).children.find((e) => (e?.type as { name?: string })?.name === "EnTeteConnexion");
    expect(entete?.props).toEqual({ nomSite: "TEST" });
  });

  it("mise en page aux proportions de la référence (9.17, correction) : classes de connexion.css, carte avant le panneau dans le DOM", async () => {
    faux.photos.mockResolvedValueOnce(["/images/connexion/1-illustration.webp"]);
    const page = (await Connexion({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve({}) } as never)) as ReactElement;
    expect((page.props as { className: string }).className).toContain("cx-page");
    // Plus de décalage pour compenser la marge de <main> : <main> n'en a plus sur cette page (globals.css).
    expect((page.props as { className: string }).className).not.toContain("-mt-8");
    const rangee = (page.props as { children: ReactElement[] }).children.find((e) => (e?.props as { className?: string })?.className === "cx-rangee")!;
    const [carte, p] = (rangee.props as { children: ReactElement[] }).children;
    expect((carte.props as Record<string, unknown>)["data-carte-connexion"]).toBe("");
    expect((carte.props as { className: string }).className).toContain("cx-carte");
    expect((p.props as Record<string, unknown>)["data-panneau-connexion"]).toBe("");
    expect((p.props as { className: string }).className).toContain("cx-panneau");
    // Hauteur et rayon du panneau : connexion.css (plus de hauteur fixe de 560 px).
    expect((p.props as { className: string }).className).not.toMatch(/min-h-\[560px\]|rounded-\[10px\]/);
  });
});
