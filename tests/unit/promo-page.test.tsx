// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ exigerAdminPage: vi.fn(), lire: vi.fn(), modifier: vi.fn(), push: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: faux.push }),
}));
vi.mock("@/lib/auth/droits", () => ({ exigerAdminPage: faux.exigerAdminPage }));
vi.mock("@/modules/promo/queries", () => ({ lireCodesPromoAdmin: faux.lire }));
vi.mock("@/modules/promo/actions", () => ({ creerCodePromoAction: vi.fn(), modifierCodePromoAction: faux.modifier, changerEtatCodePromoAction: vi.fn() }));
vi.mock("@/components/admin/CoqueAdmin", () => ({ CoqueAdmin: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
// Vrais messages, formatés par next-intl (pluriels ICU compris).
vi.mock("next-intl/server", () => ({
  getTranslations: async (espace: string) => (await import("next-intl")).createTranslator({ locale: "fr", messages: fr, namespace: espace as "Admin.codesPromo" }),
}));

import { CodesPromoSelonDroit } from "@/components/admin/CodesPromoSelonDroit";
import type { CodePromo } from "@/modules/promo/types";

const M = fr.Admin.codesPromo;
const CODE: CodePromo = {
  id: "00000000-0000-4000-8000-0000000000d1",
  code: "SOLDES10",
  affilie: "TEST_Affilié",
  reductionPct: 20,
  commissionPct: 5,
  plafond: 50,
  actif: true,
  creeLe: "2026-11-04T10:00:00Z",
  modifieLe: "2026-11-04T10:00:00Z",
  ventes: 0,
  montantCents: 0,
  commissionCents: 0,
};

// 25 codes : TEST_C01 à TEST_C25 ; les impairs sont actifs.
const VINGT_CINQ: CodePromo[] = Array.from({ length: 25 }, (_, i) => ({
  ...CODE,
  id: `00000000-0000-4000-8000-0000000001${String(i + 1).padStart(2, "0")}`,
  code: `TEST_C${String(i + 1).padStart(2, "0")}`,
  affilie: `TEST_Affilié ${i + 1}`,
  actif: i % 2 === 0,
}));

const page = (recherche: Record<string, string> = {}) => CodesPromoSelonDroit({ locale: "fr", chemin: "/admin/codes-promo", recherche });
const tableau = () => screen.getByRole("table");
// Un <tbody> par code (ligne principale, puis ligne des valeurs) : on lit la première ligne de chacun.
const lignes = () => Array.from(tableau().querySelectorAll("tbody")).map((tb) => within(tb.querySelector("tr") as HTMLElement).getAllByRole("cell"));
const numeros = () => lignes().map((cellules) => cellules[0].textContent);

beforeEach(() => {
  vi.clearAllMocks();
  faux.exigerAdminPage.mockResolvedValue({ compteId: "c", auteur: {} });
});

describe("contenu de la page /admin/codes-promo", () => {
  it("exige le droit codes_promo.gerer sur la page elle-même, avant toute lecture", async () => {
    faux.lire.mockResolvedValue([]);
    await page();
    expect(faux.exigerAdminPage).toHaveBeenCalledWith("fr", "/admin/codes-promo", "codes_promo.gerer");
  });

  it("droit refusé : la page s'arrête (404 ou redirection), rien n'est lu", async () => {
    faux.exigerAdminPage.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(page()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(faux.lire).not.toHaveBeenCalled();
  });

  it("lecture impossible : message d'erreur, « Nouveau code » conservé, aucune liste vide", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    faux.lire.mockRejectedValue(new Error("TEST"));
    rendre(await page());
    expect(screen.getByRole("alert").textContent).toContain(M.erreurLecture);
    expect(screen.queryByText(M.vide)).toBeNull();
    expect(screen.getByRole("link", { name: M.nouveau }).getAttribute("href")).toBe("/admin/codes-promo?nouveau=1");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("TEST");
    spy.mockRestore();
  });

  it("liste vide : le texte d'état ; avec des codes : le tableau", async () => {
    faux.lire.mockResolvedValue([]);
    const premier = rendre(await page());
    expect(screen.getByText(M.vide)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    premier.unmount();
    faux.lire.mockResolvedValue([CODE]);
    rendre(await page());
    expect(within(tableau()).getByText("SOLDES10")).toBeTruthy();
  });

  it("titre CODES PROMO, « + NOUVEAU CODE », recherche et pastilles TOUS / ACTIFS / INACTIFS (TOUS actif par défaut)", async () => {
    faux.lire.mockResolvedValue([CODE]);
    rendre(await page());
    expect(screen.getByRole("heading", { level: 1, name: M.titre })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: M.recherche.libelle })).toBeTruthy();
    const pastilles = within(screen.getByRole("list", { name: M.filtres.libelle })).getAllByRole("link");
    expect(pastilles.map((a) => a.textContent)).toEqual([M.filtres.tous, M.filtres.actifs, M.filtres.inactifs]);
    expect(pastilles.map((a) => a.getAttribute("aria-current"))).toEqual(["true", null, null]);
    expect(pastilles[2].getAttribute("href")).toBe("/admin/codes-promo?filtre=inactifs");
  });

  it("25 codes : 2 pages ; la deuxième montre les N° 21 à 25 et « page 2 / 2 »", async () => {
    faux.lire.mockResolvedValue(VINGT_CINQ);
    const un = rendre(await page());
    expect(numeros()).toHaveLength(20);
    expect(numeros()[0]).toBe("1");
    expect(screen.getByRole("link", { name: fr.Admin.ui.suivante }).getAttribute("href")).toBe("/admin/codes-promo?page=2");
    un.unmount();
    rendre(await page({ page: "2" }));
    expect(numeros()).toEqual(["21", "22", "23", "24", "25"]);
    expect(within(tableau()).getByText("TEST_C21")).toBeTruthy();
    expect(screen.getByText("Page 2 / 2")).toBeTruthy();
  });

  it("page au-delà de la dernière (adresse modifiée) : la dernière page est affichée", async () => {
    faux.lire.mockResolvedValue(VINGT_CINQ);
    rendre(await page({ page: "9" }));
    expect(numeros()).toEqual(["21", "22", "23", "24", "25"]);
  });

  it("filtre INACTIFS et recherche dans la liste lue (sans casse ni accents), sans nouvelle lecture", async () => {
    faux.lire.mockResolvedValue(VINGT_CINQ);
    rendre(await page({ filtre: "inactifs", q: "affilie 1" }));
    // Inactifs = codes pairs ; « affilie 1 » : 10, 12, 14, 16, 18.
    const codes = lignes().map((cellules) => cellules[3].textContent);
    expect(codes).toEqual(["TEST_C10", "TEST_C12", "TEST_C14", "TEST_C16", "TEST_C18"]);
    expect(faux.lire).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("5 codes");
    expect(screen.getByRole("link", { name: M.recherche.effacer }).getAttribute("href")).toBe("/admin/codes-promo?filtre=inactifs");
  });

  it("recherche sans résultat : un texte le dit, jamais un tableau vide", async () => {
    faux.lire.mockResolvedValue([CODE]);
    rendre(await page({ q: "introuvable" }));
    expect(screen.getByText(M.aucunResultat)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("?nouveau=1 : fenêtre de création (formulaire existant) ; la croix ramène à la liste avec ses filtres", async () => {
    faux.lire.mockResolvedValue([CODE]);
    rendre(await page({ nouveau: "1", filtre: "actifs" }));
    const fenetre = document.querySelector("[data-fenetre-formulaire]") as HTMLElement;
    expect(within(fenetre).getByRole("heading", { level: 1, name: M.creation.titre })).toBeTruthy();
    expect(within(fenetre).getByLabelText(M.champs.code)).toBeTruthy();
    expect(within(fenetre).getByRole("link", { name: fr.Admin.ui.fermer }).getAttribute("href")).toBe("/admin/codes-promo?filtre=actifs");
    // Fond plein écran « sans la liste derrière » (Q23 a).
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("compteur : vrais pluriels (« Aucun code », « 1 code », « N codes »)", async () => {
    faux.lire.mockResolvedValue([]);
    const a = rendre(await page());
    expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Aucun code");
    a.unmount();
    faux.lire.mockResolvedValue([CODE]);
    rendre(await page());
    expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("1 code");
  });

  it("page trop grande : retour de la fenêtre et liens gardent la page ramenée à la dernière", async () => {
    faux.lire.mockResolvedValue(VINGT_CINQ);
    rendre(await page({ page: "9", nouveau: "1" }));
    const fenetre = document.querySelector("[data-fenetre-formulaire]") as HTMLElement;
    expect(within(fenetre).getByRole("link", { name: fr.Admin.ui.fermer }).getAttribute("href")).toBe("/admin/codes-promo?page=2");
  });

  it("fenêtre de modification : « Enregistrer » de l'en-tête soumet le formulaire ; après le succès, Échap revient à la liste sans « Quitter sans enregistrer ? »", async () => {
    faux.lire.mockResolvedValue([CODE]);
    faux.modifier.mockResolvedValue({ ok: true });
    rendre(await page({ modifier: CODE.id }));
    const fenetre = document.querySelector("[data-fenetre-formulaire]") as HTMLElement;
    await userEvent.type(within(fenetre).getByLabelText(M.champs.affilie), "x");
    const boutons = within(fenetre).getAllByRole("button", { name: fr.Admin.ui.enregistrer });
    await userEvent.click(boutons[0]);
    await waitFor(() => expect(faux.modifier).toHaveBeenCalledWith(CODE.id, expect.objectContaining({ affilie: "TEST_Affiliéx" })));
    await waitFor(() => expect(within(fenetre).getByText(M.succes.modification)).toBeTruthy());
    // La fenêtre ignore Échap tant qu'elle est occupée (envoi en cours) : on attend la fin, signalée par l'en-tête (« Enregistrer » de nouveau actif).
    await waitFor(() => expect(boutons[0].getAttribute("aria-disabled")).toBeNull());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(faux.push).toHaveBeenCalledWith("/admin/codes-promo"));
    expect(screen.queryByRole("dialog", { name: fr.Admin.ui.quitter.titre })).toBeNull();
    // Saisie et clics réels : jusqu'à 8 s quand toute la suite tourne en parallèle (délai par défaut de 5 s dépassé).
  }, 20_000);

  it("?modifier=<id> : fenêtre de modification préremplie ; identifiant inconnu : message, aucun formulaire", async () => {
    faux.lire.mockResolvedValue([CODE]);
    const un = rendre(await page({ modifier: CODE.id }));
    let fenetre = document.querySelector("[data-fenetre-formulaire]") as HTMLElement;
    expect(within(fenetre).getByRole("heading", { level: 1, name: M.modification.titre })).toBeTruthy();
    expect((within(fenetre).getByLabelText(M.champs.affilie) as HTMLInputElement).value).toBe("TEST_Affilié");
    un.unmount();
    rendre(await page({ modifier: "00000000-0000-4000-8000-0000000009ff" }));
    fenetre = document.querySelector("[data-fenetre-formulaire]") as HTMLElement;
    expect(within(fenetre).getByText(M.erreurs.introuvable)).toBeTruthy();
    expect(within(fenetre).queryByLabelText(M.champs.affilie)).toBeNull();
    // Rien à enregistrer : pas de bouton « Enregistrer » dans l'en-tête.
    expect(within(fenetre).queryByRole("button", { name: fr.Admin.ui.enregistrer })).toBeNull();
  });
});
