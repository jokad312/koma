// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/compte", () => ({ lireSessionVerifiee: () => faux.session() }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/layout/BoutonDeconnexion", () => ({ BoutonDeconnexion: () => <button type="button">Se déconnecter</button> }));
vi.mock("@/components/layout/LienConnexion", () => ({ LienConnexion: () => <a href="#connexion">Se connecter</a> }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const fr = (await import("../../messages/fr.json")).default;
  return { getTranslations: async (namespace: string) => createTranslator({ locale: "fr", messages: fr, namespace: namespace as never }) };
});

import { ZoneCompte } from "@/components/layout/ZoneCompte";

beforeEach(() => faux.session.mockReset());

describe("ZoneCompte (en-tête et panneau ☰)", () => {
  it("connecté : « Mon compte » (vers la Navigation du compte : commandes, bibliothèque, photos, préférences) puis « Se déconnecter »", async () => {
    faux.session.mockResolvedValue({ id: "TEST" });
    rendre(await ZoneCompte());
    expect(screen.getByRole("link", { name: "Mon compte" }).getAttribute("href")).toBe("/compte");
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeTruthy();
  });

  it("visiteur : « Se connecter », aucun lien de compte", async () => {
    faux.session.mockResolvedValue(null);
    rendre(await ZoneCompte());
    expect(screen.getByRole("link", { name: "Se connecter" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Mon compte" })).toBeNull();
  });
});
