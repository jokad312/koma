// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ exigerAdminPage: vi.fn(), lire: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/auth/droits", () => ({ exigerAdminPage: faux.exigerAdminPage }));
vi.mock("@/modules/promo/queries", () => ({ lireCodesPromoAdmin: faux.lire }));
vi.mock("@/modules/promo/actions", () => ({ creerCodePromoAction: vi.fn(), modifierCodePromoAction: vi.fn() }));
vi.mock("@/components/admin/CoqueAdmin", () => ({ CoqueAdmin: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (cle: string) => cle.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], fr.Admin.codesPromo) as string,
}));

import { CodesPromoSelonDroit } from "@/components/admin/CodesPromoSelonDroit";

const M = fr.Admin.codesPromo;
const CODE = {
  id: "00000000-0000-4000-8000-0000000000d1",
  code: "SOLDES10",
  affilie: "TEST_Affilié",
  reductionPct: 20,
  commissionPct: 5,
  plafond: 50,
  actif: true,
  creeLe: "2026-11-04T10:00:00Z",
  modifieLe: "2026-11-04T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  faux.exigerAdminPage.mockResolvedValue({ compteId: "c", auteur: {} });
});

describe("contenu de la page /admin/codes-promo", () => {
  it("exige le droit codes_promo.gerer sur la page elle-même, avant toute lecture", async () => {
    faux.lire.mockResolvedValue([]);
    await CodesPromoSelonDroit({ locale: "fr", chemin: "/admin/codes-promo" });
    expect(faux.exigerAdminPage).toHaveBeenCalledWith("fr", "/admin/codes-promo", "codes_promo.gerer");
  });

  it("droit refusé : la page s'arrête (404 ou redirection), rien n'est lu", async () => {
    faux.exigerAdminPage.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(CodesPromoSelonDroit({ locale: "fr", chemin: "/admin/codes-promo" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(faux.lire).not.toHaveBeenCalled();
  });

  it("lecture impossible : message d'erreur, formulaire de création conservé, aucune liste vide", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    faux.lire.mockRejectedValue(new Error("TEST"));
    rendre(await CodesPromoSelonDroit({ locale: "fr", chemin: "/admin/codes-promo" }));
    expect(screen.getByRole("alert").textContent).toContain(M.erreurLecture);
    expect(screen.queryByText(M.vide)).toBeNull();
    expect(screen.getByRole("heading", { name: M.creation.titre })).toBeTruthy();
    expect(JSON.stringify(spy.mock.calls)).not.toContain("TEST");
    spy.mockRestore();
  });

  it("liste vide : le texte d'état ; avec des codes : la liste", async () => {
    faux.lire.mockResolvedValue([]);
    const premier = rendre(await CodesPromoSelonDroit({ locale: "fr", chemin: "/admin/codes-promo" }));
    expect(screen.getByText(M.vide)).toBeTruthy();
    premier.unmount();
    faux.lire.mockResolvedValue([CODE]);
    rendre(await CodesPromoSelonDroit({ locale: "fr", chemin: "/admin/codes-promo" }));
    expect(screen.getByRole("heading", { name: "SOLDES10" })).toBeTruthy();
  });
});
