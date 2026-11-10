// @vitest-environment jsdom
// Décision de Jonathan (2026-11-10) : ouvrir le lien ne désinscrit jamais ; seul un POST signé désinscrit (bouton de la page, ou
// désinscription en un clic RFC 8058 par /api/desinscription). Un jeton altéré est refusé.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ desinscrire: vi.fn(), action: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/preferences/dependances", () => ({ dependancesPreferences: () => ({ desinscrire: faux.desinscrire }) }));
vi.mock("@/modules/preferences/actions", () => ({ desinscrireAction: (...a: unknown[]) => faux.action(...a) }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("../../messages/fr.json")).default;
  return { getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({ locale: "fr", messages, namespace: namespace as never }) };
});
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import * as route from "@/app/api/desinscription/route";
import { ConfirmationDesinscription } from "@/components/preferences/ConfirmationDesinscription";
import { ResultatDesinscription } from "@/components/preferences/ResultatDesinscription";
import { signerDesinscription } from "@/modules/preferences/lien-desinscription";

const COMPTE = "00000000-0000-4000-8000-0000000000e1";
const D = fr.Desinscription;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DESINSCRIPTION_SECRET = "TEST_secret_de_desinscription_assez_long_0123456789";
  faux.desinscrire.mockResolvedValue({ fait: true });
});

const requete = (s: string) => new Request(`https://test.example.invalid/api/desinscription?c=${COMPTE}&s=${encodeURIComponent(s)}`, { method: "POST", body: "List-Unsubscribe=One-Click" });

describe("désinscription en un clic (RFC 8058)", () => {
  it("POST signé : désinscrit (200)", async () => {
    const r = await route.POST(requete(signerDesinscription(COMPTE)));
    expect(r.status).toBe(200);
    expect(faux.desinscrire).toHaveBeenCalledWith(COMPTE);
  });

  it("jeton altéré : refusé (400), la base n'est jamais appelée", async () => {
    const s = signerDesinscription(COMPTE);
    const r = await route.POST(requete(s.replace(/^./, (c) => (c === "A" ? "B" : "A"))));
    expect(r.status).toBe(400);
    expect(faux.desinscrire).not.toHaveBeenCalled();
  });

  it("POST signé sans le corps RFC 8058 (List-Unsubscribe=One-Click) : refusé (400), rien n'est écrit", async () => {
    const r = await route.POST(new Request(`https://test.example.invalid/api/desinscription?c=${COMPTE}&s=${encodeURIComponent(signerDesinscription(COMPTE))}`, { method: "POST" }));
    expect(r.status).toBe(400);
    expect(faux.desinscrire).not.toHaveBeenCalled();
  });

  it("base en erreur : 500, jamais un faux succès pour la messagerie", async () => {
    faux.desinscrire.mockResolvedValue({ erreur: "TEST" });
    expect((await route.POST(requete(signerDesinscription(COMPTE)))).status).toBe(500);
  });

  it("aucune méthode GET : un antivirus ou un aperçu qui ouvre l'adresse ne désinscrit pas", () => {
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });
});

describe("page de confirmation", () => {
  it("ouvrir le lien (rendu serveur de la page) ne désinscrit jamais ; lien valide : bouton, lien altéré : message, sans bouton", async () => {
    const { NextIntlClientProvider } = await import("next-intl");
    const valide = await ResultatDesinscription({ locale: "fr", c: COMPTE, s: signerDesinscription(COMPTE) });
    const { unmount } = rendre(<NextIntlClientProvider locale="fr" messages={fr}>{valide}</NextIntlClientProvider>);
    expect(screen.getByRole("button", { name: D.confirmer })).toBeTruthy();
    unmount();
    const altere = await ResultatDesinscription({ locale: "fr", c: COMPTE, s: "TEST_faux" });
    rendre(<NextIntlClientProvider locale="fr" messages={fr}>{altere}</NextIntlClientProvider>);
    expect(screen.getByText(D.invalide)).toBeTruthy();
    expect(screen.queryByRole("button", { name: D.confirmer })).toBeNull();
    expect(faux.desinscrire).not.toHaveBeenCalled();
  });

  it("afficher la page ne désinscrit pas ; seul le bouton envoie la demande signée", async () => {
    faux.action.mockResolvedValue("desinscrit");
    rendre(<ConfirmationDesinscription c={COMPTE} s="TEST_signature" />);
    expect(screen.getByText(D.question)).toBeTruthy();
    expect(faux.action).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: D.confirmer }));
    expect(faux.action).toHaveBeenCalledWith({ c: COMPTE, s: "TEST_signature" });
    expect(await screen.findByText(D.fait)).toBeTruthy();
  });

  it("refus du serveur (lien non valide) : jamais un faux succès", async () => {
    faux.action.mockResolvedValue("lien_invalide");
    rendre(<ConfirmationDesinscription c={COMPTE} s="TEST_signature" />);
    await userEvent.click(screen.getByRole("button", { name: D.confirmer }));
    await waitFor(() => expect(screen.getByText(D.invalide)).toBeTruthy());
    expect(screen.queryByText(D.fait)).toBeNull();
  });
});
