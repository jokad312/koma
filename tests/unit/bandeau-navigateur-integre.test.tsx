// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BandeauNavigateurIntegreClient } from "@/components/layout/BandeauNavigateurIntegreClient";
import { rendre } from "./aides-dom";

beforeEach(() => window.localStorage.clear());

describe("BandeauNavigateurIntegreClient", () => {
  it("région libellée, avec « Ouvrir dans mon navigateur » sur Android (lien vers Chrome avec repli)", async () => {
    rendre(<BandeauNavigateurIntegreClient plateforme="android" />);
    expect(screen.getByRole("region", { name: "Ouvrir dans ton navigateur" })).toBeTruthy();
    const lien = await screen.findByRole("link", { name: "Ouvrir dans mon navigateur" });
    const href = lien.getAttribute("href") ?? "";
    expect(href).toMatch(/^intent:\/\//);
    expect(href).toContain("package=com.android.chrome");
    expect(href).toContain("S.browser_fallback_url=");
  });

  it("iPhone : pas de lien, « Copier le lien » et l'instruction Safari", () => {
    rendre(<BandeauNavigateurIntegreClient plateforme="ios" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "Copier le lien" })).toBeTruthy();
    expect(screen.getByText(/Ouvrir dans Safari/)).toBeTruthy();
  });

  it("fermeture : cible de 44 px, choix mémorisé, bandeau absent au rendu suivant", () => {
    const { unmount } = rendre(<BandeauNavigateurIntegreClient plateforme="ios" />);
    const fermer = screen.getByRole("button", { name: "Fermer l'avis" });
    expect(fermer.className).toContain("min-h-touch");
    fireEvent.click(fermer);
    expect(screen.queryByRole("region")).toBeNull();
    unmount();
    rendre(<BandeauNavigateurIntegreClient plateforme="ios" />);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("copie impossible : message écrit, rien d'annoncé comme copié", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("refus")) }, configurable: true });
    rendre(<BandeauNavigateurIntegreClient plateforme="ios" />);
    fireEvent.click(screen.getByRole("button", { name: "Copier le lien" }));
    expect(await screen.findByText(/Copie impossible/)).toBeTruthy();
    expect(screen.queryByText("Lien copié.")).toBeNull();
  });
});
