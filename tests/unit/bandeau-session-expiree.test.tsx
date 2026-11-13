// @vitest-environment jsdom
// Story 9.14 : bandeau des pages publiques après une déconnexion pour inactivité.
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ chemin: "/fr/cosplays" }));
vi.mock("next/navigation", () => ({ usePathname: () => faux.chemin }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: { href: { pathname: string; query?: Record<string, string> }; children: React.ReactNode }) => (
    <a href={`${href.pathname}${href.query ? `?${new URLSearchParams(href.query)}` : ""}`} {...r}>
      {children}
    </a>
  ),
}));

import { BandeauSessionExpiree } from "@/components/layout/BandeauSessionExpiree";

const MESSAGE = "Ta session a expiré après une longue inactivité. Reconnecte-toi pour continuer.";

afterEach(() => {
  document.cookie = "koma_session_expiree=; path=/; max-age=0";
  faux.chemin = "/fr/cosplays";
  document.body.innerHTML = "";
});

describe("BandeauSessionExpiree", () => {
  it("sans cookie : région d'annonce vide, ni lien ni bouton", () => {
    rendre(<BandeauSessionExpiree />);
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("avec cookie : message dans la région, lien de reconnexion avec retour hors de la région", async () => {
    document.cookie = "koma_session_expiree=1; path=/";
    rendre(<BandeauSessionExpiree />);
    expect(await screen.findByText(MESSAGE)).toBeTruthy();
    const lien = screen.getByRole("link", { name: "Se reconnecter" });
    expect(lien.getAttribute("href")).toBe("/connexion?retour=%2Ffr%2Fcosplays");
    expect(screen.getByRole("status").contains(lien)).toBe(false);
  });

  it("absent sur la page de connexion", () => {
    document.cookie = "koma_session_expiree=1; path=/";
    faux.chemin = "/fr/connexion";
    rendre(<BandeauSessionExpiree />);
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it("« Fermer » efface le cookie, retire le message et met le focus sur le contenu", async () => {
    document.cookie = "koma_session_expiree=1; path=/";
    const main = document.createElement("main");
    main.id = "contenu";
    main.tabIndex = -1;
    document.body.appendChild(main);
    rendre(<BandeauSessionExpiree />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Fermer le message" }));
    expect(document.cookie).not.toContain("koma_session_expiree=1");
    expect(screen.queryByText(MESSAGE)).toBeNull();
    expect(document.activeElement).toBe(main);
  });
});
