// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/est-admin", () => ({ estAdminConnecte: () => faux.admin() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const fr = (await import("../../messages/fr.json")).default;
  return { getTranslations: async (namespace: string) => createTranslator({ locale: "fr", messages: fr, namespace: namespace as never }) };
});

import { LienAdminCompte } from "@/components/layout/LienAdminCompte";

beforeEach(() => faux.admin.mockReset());

describe("LienAdminCompte (Navigation du compte)", () => {
  it("admin : entrée « Administration » vers /admin", async () => {
    faux.admin.mockResolvedValue(true);
    rendre(<ul>{await LienAdminCompte()}</ul>);
    expect(screen.getByRole("link", { name: "Administration" }).getAttribute("href")).toBe("/admin");
  });

  it("client : aucune entrée, aucun élément de liste vide", async () => {
    faux.admin.mockResolvedValue(false);
    const { container } = rendre(<ul>{await LienAdminCompte()}</ul>);
    expect(screen.queryByRole("link", { name: "Administration" })).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });
});
