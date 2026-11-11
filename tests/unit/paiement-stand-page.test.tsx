// @vitest-environment jsdom
// Story 7.11 : page de paiement d'un Stand accepté. Réservée au Compte du candidat (autre Compte ou inconnue = 404), « Délai dépassé » après l'échéance
// enregistrée, redirections vers la Commande ou « Mes Pass », formulaire avec nom de l'aide facultatif.
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  etatCompte: vi.fn(),
  session: vi.fn(),
  candidature: vi.fn(),
  recap: vi.fn(),
}));
class Redirection extends Error {}
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("TEST_404");
  },
  redirect: (url: string) => {
    throw new Redirection(url);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth/compte", () => ({ lireEtatCompte: faux.etatCompte, lireSessionVerifiee: faux.session }));
vi.mock("@/modules/evenements/candidature-queries", () => ({ lireCandidatureDuCompte: faux.candidature }));
vi.mock("@/modules/evenements/candidature-dependances", () => ({
  dependancesPaiementStand: () => ({ nomDuCompte: async () => "TEST_ Alice Exposante" }),
}));
vi.mock("@/modules/evenements/candidature-paiement", () => ({ lireRecapitulatifStand: faux.recap }));
vi.mock("@/modules/evenements/candidature-actions", () => ({ lireRecapitulatifStandAction: vi.fn(), creerCommandeStandAction: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const fr = (await import("../../messages/fr.json")).default;
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => createTranslator({ locale, messages: fr as never, namespace: namespace as never }),
  };
});

import { PagePaiementStand } from "@/components/festival/PagePaiementStand";

const ID = "00000000-0000-4000-8000-0000000000d1";
const COMPTE = "11111111-1111-4111-8111-111111111111";
const cand = (s: Record<string, unknown> = {}) => ({ id: ID, evenementSlug: "test-evenement", expireLe: "2099-01-01T10:00:00Z", etat: "valide", numeroCommande: null, ...s });
const recap = { ok: true, recap: { candidatureId: ID, expireLe: "2099-01-01T10:00:00Z", nom: "TEST_Stand", prixCents: 4000, reductionCents: 0, totalCents: 4000, code: null } };

async function page(slug = "test-evenement") {
  return rendre(await PagePaiementStand({ locale: "fr", slug, candidatureId: ID }));
}

beforeEach(() => {
  vi.clearAllMocks();
  faux.etatCompte.mockResolvedValue("complet");
  faux.session.mockResolvedValue({ compteId: COMPTE });
  faux.candidature.mockResolvedValue(cand());
  faux.recap.mockResolvedValue(recap);
});

describe("PagePaiementStand", () => {
  it("la candidature est lue pour le Compte de la session (jamais par l'adresse seule)", async () => {
    await page();
    expect(faux.candidature).toHaveBeenCalledWith(COMPTE, ID);
  });

  it("candidature d'un autre Compte ou inconnue : 404, rien n'est révélé", async () => {
    faux.candidature.mockResolvedValue(null);
    await expect(page()).rejects.toThrow("TEST_404");
    expect(faux.recap).not.toHaveBeenCalled();
  });

  it("adresse d'un autre Événement : 404", async () => {
    await expect(page("autre-evenement")).rejects.toThrow("TEST_404");
  });

  it("non connecté : redirigé vers la connexion avec retour", async () => {
    faux.etatCompte.mockResolvedValue("anonyme");
    await expect(page()).rejects.toThrow(/\/fr\/connexion\?retour=/);
  });

  it("délai dépassé : message dédié, aucun formulaire de paiement", async () => {
    faux.candidature.mockResolvedValue(cand({ etat: "expiree" }));
    await page();
    expect(screen.getByText("Délai dépassé : la place a été libérée.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirmer/ })).toBeNull();
    expect(faux.recap).not.toHaveBeenCalled();
  });

  it("candidature refusée : message dédié", async () => {
    faux.candidature.mockResolvedValue(cand({ etat: "refusee" }));
    await page();
    expect(screen.getByText(/Cette candidature a été refusée/)).toBeTruthy();
  });

  it("Commande déjà à payer : retour vers elle ; déjà payée : vers Mes Pass", async () => {
    faux.candidature.mockResolvedValue(cand({ etat: "a_payer", numeroCommande: "KS-2026-000900" }));
    await expect(page()).rejects.toThrow("/fr/commande/KS-2026-000900");
    faux.candidature.mockResolvedValue(cand({ etat: "payee" }));
    await expect(page()).rejects.toThrow("/fr/compte/pass");
  });

  it("état valide : heure limite, nom du Compte, nom de l'aide facultatif, mention non pré-cochée, total relu en base", async () => {
    await page();
    expect(screen.getByText(/ta place est réservée jusqu'au/)).toBeTruthy();
    expect(screen.getByText(/TEST_ Alice Exposante/)).toBeTruthy();
    expect(screen.getByLabelText("Nom de ton aide (facultatif)")).toBeTruthy();
    const mention = screen.getByRole("checkbox", { name: /Des photos et vidéos sont prises/ }) as HTMLInputElement;
    expect(mention.checked).toBe(false);
    expect(screen.getByText("Deux Pass nominatifs inclus.")).toBeTruthy();
    expect(screen.getAllByText(/40,00|\$40|40\.00/).length).toBeGreaterThan(0);
  });
});
