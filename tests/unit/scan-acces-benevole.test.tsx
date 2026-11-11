// @vitest-environment jsdom
// Story 7.7 : écran de Scan vu par un bénévole. Il ne voit QUE les Événements de son accès valable (validité donnée par la base), jamais le choix libre ;
// sans aucun accès : 404 ; accès pas encore ouvert ou terminé : message clair ; visiteur : connexion ; l'Admin garde la liste complète et le lien vers l'admin.
// Lecture des accès avec un client Supabase FAUX (données TEST_).
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const faux = vi.hoisted(() => ({
  exigerConnectePage: vi.fn(),
  lireScannables: vi.fn(),
  lireDeLAcces: vi.fn(),
  rpc: vi.fn(),
  evenements: { data: [] as unknown[], error: null as unknown },
  filtres: [] as Array<{ nom: string; args: unknown[] }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("TEST_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`TEST_REDIRECT:${url}`);
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async (ns: string) => (cle: string) => cle.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], (fr as Record<string, unknown>)[ns]) as string,
}));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/components/scan/EcranScan", () => ({
  EcranScan: ({ evenements, benevole }: { evenements: Array<{ id: string; titre: string }>; benevole?: boolean }) => (
    <div data-testid="ecran" data-benevole={String(benevole === true)}>
      {evenements.map((e) => e.titre).join("|")}
    </div>
  ),
}));
vi.mock("@/lib/auth/droits", async () => ({
  droitAutorise: (await import("@/lib/auth/matrice-droits")).droitAutorise,
  exigerConnectePage: (...a: unknown[]) => faux.exigerConnectePage(...a),
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: (...a: unknown[]) => faux.rpc(...a),
    from: () => {
      const b: Record<string, unknown> = {};
      for (const nom of ["select", "in", "order", "not", "lte", "or"]) {
        b[nom] = (...args: unknown[]) => {
          faux.filtres.push({ nom, args });
          return b;
        };
      }
      b.then = (resoudre: (r: unknown) => unknown) => Promise.resolve(faux.evenements).then(resoudre);
      return b;
    },
  }),
}));
vi.mock("@/modules/scan/queries", () => ({
  lireEvenementsScannables: (...a: unknown[]) => faux.lireScannables(...a),
  lireEvenementsDeLAccesBenevole: (...a: unknown[]) => faux.lireDeLAcces(...a),
}));

import { ScanSelonDroit } from "@/components/scan/ScanSelonDroit";

const EV1 = "00000000-0000-4000-8000-0000000000e1";
const EV2 = "00000000-0000-4000-8000-0000000000e2";
const M = fr.Scan;

async function rendrePage(locale: "fr" | "en" = "fr") {
  const ui = await ScanSelonDroit({ locale, chemin: "/scan" });
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  faux.filtres.length = 0;
});

describe("page de Scan : bénévole", () => {
  it("ne montre que l'Événement de son accès valable, jamais la liste des Événements", async () => {
    faux.exigerConnectePage.mockResolvedValue({ compteId: "TEST_benevole", role: null });
    faux.lireDeLAcces.mockResolvedValue({ evenements: [{ id: EV1, titre: "TEST_Festival", debutLe: null, finLe: null }], accesConnus: true });
    await rendrePage();
    expect(faux.lireDeLAcces).toHaveBeenCalledWith("fr", "TEST_benevole");
    expect(faux.lireScannables).not.toHaveBeenCalled();
    const ecran = screen.getByTestId("ecran");
    expect(ecran.textContent).toBe("TEST_Festival");
    expect(ecran.getAttribute("data-benevole")).toBe("true");
  });
  it("pas de lien vers l'administration (qui lui répondrait 404)", async () => {
    faux.exigerConnectePage.mockResolvedValue({ compteId: "TEST_benevole", role: "benevole" });
    faux.lireDeLAcces.mockResolvedValue({ evenements: [{ id: EV1, titre: "TEST_Festival", debutLe: null, finLe: null }], accesConnus: true });
    await rendrePage();
    expect(screen.queryByText(M.retourAdmin)).toBeNull();
    expect(document.querySelector("a[href='/admin']")).toBeNull();
  });
  it("accès pas encore ouvert ou terminé : message clair, pas d'écran de Scan", async () => {
    faux.exigerConnectePage.mockResolvedValue({ compteId: "TEST_benevole", role: null });
    faux.lireDeLAcces.mockResolvedValue({ evenements: [], accesConnus: true });
    await rendrePage();
    expect(screen.getByRole("status").textContent).toContain(M.acces.indisponible);
    expect(screen.queryByTestId("ecran")).toBeNull();
  });
  it("aucun accès du tout : 404 comme pour tout Compte sans droit", async () => {
    faux.exigerConnectePage.mockResolvedValue({ compteId: "TEST_simple", role: null });
    faux.lireDeLAcces.mockResolvedValue({ evenements: [], accesConnus: false });
    await expect(rendrePage()).rejects.toThrow("TEST_NOT_FOUND");
  });
  it("l'Assistant n'a pas le Scan par son rôle : il suit le chemin du bénévole (accès par Événement)", async () => {
    faux.exigerConnectePage.mockResolvedValue({ compteId: "TEST_assistant", role: "assistant" });
    faux.lireDeLAcces.mockResolvedValue({ evenements: [], accesConnus: false });
    await expect(rendrePage()).rejects.toThrow("TEST_NOT_FOUND");
    expect(faux.lireScannables).not.toHaveBeenCalled();
  });
  it("lecture impossible pour un Compte sans droit connu : 404, jamais un écran d'erreur ni de Scan", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    faux.exigerConnectePage.mockResolvedValue({ compteId: "TEST_benevole", role: null });
    faux.lireDeLAcces.mockRejectedValue(new Error("TEST"));
    await expect(rendrePage()).rejects.toThrow("TEST_NOT_FOUND");
    spy.mockRestore();
  });
  it("lecture impossible pour l'Admin : message d'erreur, pas d'écran de Scan", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    faux.exigerConnectePage.mockResolvedValue({ compteId: "TEST_admin", role: "admin" });
    faux.lireScannables.mockRejectedValue(new Error("TEST"));
    await rendrePage();
    expect(screen.getByRole("alert").textContent).toContain(M.evenement.erreurLecture);
    expect(screen.queryByTestId("ecran")).toBeNull();
    spy.mockRestore();
  });
  it("visiteur : la redirection vers la connexion vient de exigerConnectePage, rien n'est lu", async () => {
    faux.exigerConnectePage.mockRejectedValue(new Error("TEST_REDIRECT:/fr/connexion?retour=%2Ffr%2Fscan"));
    await expect(rendrePage()).rejects.toThrow("TEST_REDIRECT");
    expect(faux.lireDeLAcces).not.toHaveBeenCalled();
    expect(faux.lireScannables).not.toHaveBeenCalled();
  });
});

describe("page de Scan : Admin", () => {
  it("garde la liste complète des Événements et le lien vers l'administration", async () => {
    faux.exigerConnectePage.mockResolvedValue({ compteId: "TEST_admin", role: "admin" });
    faux.lireScannables.mockResolvedValue([
      { id: EV1, titre: "TEST_Un", debutLe: null, finLe: null },
      { id: EV2, titre: "TEST_Deux", debutLe: null, finLe: null },
    ]);
    await rendrePage("en");
    expect(faux.lireDeLAcces).not.toHaveBeenCalled();
    expect(screen.getByTestId("ecran").textContent).toBe("TEST_Un|TEST_Deux");
    expect(screen.getByTestId("ecran").getAttribute("data-benevole")).toBe("false");
    expect(document.querySelector("a[href='/admin']")).not.toBeNull();
  });
});

describe("lecture des Événements d'un accès bénévole", () => {
  async function lire(acces: unknown, evenements: { data: unknown; error: unknown } = { data: [], error: null }) {
    const reel = (await vi.importActual<typeof import("@/modules/scan/queries")>("@/modules/scan/queries")).lireEvenementsDeLAccesBenevole;
    faux.rpc.mockResolvedValue(acces);
    faux.evenements = evenements as typeof faux.evenements;
    return reel("fr", "TEST_benevole");
  }
  it("ne retient que les accès que la BASE annonce valides maintenant", async () => {
    const r = await lire(
      { data: [{ evenement_id: EV1, valide: true }, { evenement_id: EV2, valide: false }], error: null },
      { data: [{ id: EV1, titre_fr: "TEST_Un", titre_en: null, debut_le: null, fin_le: null }], error: null },
    );
    expect(faux.rpc).toHaveBeenCalledWith("lire_acces_benevole_compte", { p_compte: "TEST_benevole" });
    expect(faux.filtres.find((f) => f.nom === "in")?.args).toEqual(["id", [EV1]]);
    expect(r).toEqual({ accesConnus: true, evenements: [{ id: EV1, titre: "TEST_Un", debutLe: null, finLe: null }] });
  });
  it("accès connus mais aucun valable : aucune lecture d'Événement", async () => {
    const r = await lire({ data: [{ evenement_id: EV2, valide: false }], error: null });
    expect(r).toEqual({ evenements: [], accesConnus: true });
    expect(faux.filtres).toHaveLength(0);
  });
  it("aucun accès : accesConnus faux", async () => {
    expect(await lire({ data: [], error: null })).toEqual({ evenements: [], accesConnus: false });
  });
  it("erreur de la base : relancée, jamais une liste vide", async () => {
    await expect(lire({ data: null, error: { message: "x" } })).rejects.toThrow();
    await expect(lire({ data: [{ evenement_id: EV1, valide: true }], error: null }, { data: null, error: { message: "x" } })).rejects.toThrow();
  });
});
