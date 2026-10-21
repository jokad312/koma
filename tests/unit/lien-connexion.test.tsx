// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LienConnexion } from "@/components/layout/LienConnexion";
import { rendre } from "./aides-dom";

const chemin = vi.hoisted(() => ({ valeur: "/fr" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => chemin.valeur,
}));

beforeEach(() => {
  chemin.valeur = "/fr";
});

describe("LienConnexion", () => {
  it("hors accueil : l'adresse contient le chemin de retour", () => {
    chemin.valeur = "/fr/cosplays/x";
    rendre(<LienConnexion />);
    const href = decodeURIComponent(screen.getByRole("link", { name: "Se connecter" }).getAttribute("href") ?? "");
    expect(href).toContain("/connexion");
    expect(href).toContain("retour=/fr/cosplays/x");
  });

  it("sur l'accueil : pas de retour", () => {
    rendre(<LienConnexion />);
    const href = screen.getByRole("link", { name: "Se connecter" }).getAttribute("href") ?? "";
    expect(href).toContain("/connexion");
    expect(href).not.toContain("retour");
  });
});
