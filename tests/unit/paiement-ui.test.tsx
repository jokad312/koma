// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  changer: vi.fn(),
  deplacer: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: faux.refresh }) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("@/modules/paiement/actions", () => ({
  changerEtatPrestataireAction: (...a: unknown[]) => faux.changer(...a),
  deplacerPrestataireAction: (...a: unknown[]) => faux.deplacer(...a),
}));

import { ListePrestataires, type PrestataireAdmin } from "@/components/admin/ListePrestataires";

const base: PrestataireAdmin[] = [
  { code: "pawapay", nom: "TEST_PawaPay", type: "agregateur", mobileMoney: true, carte: false, actif: false, ordre: 1, adaptateurBranche: true, couples: [] },
  { code: "kpay", nom: "TEST_K-Pay", type: "agregateur", mobileMoney: true, carte: true, actif: true, ordre: 2, adaptateurBranche: true, couples: [] },
  { code: "maishapay", nom: "TEST_MaishaPay", type: "agregateur", mobileMoney: true, carte: false, actif: false, ordre: 3, adaptateurBranche: false, couples: [] },
  { code: "polar", nom: "TEST_Polar", type: "carte", mobileMoney: false, carte: true, actif: false, ordre: null, adaptateurBranche: false, couples: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  faux.changer.mockResolvedValue({ ok: true });
  faux.deplacer.mockResolvedValue({ ok: true });
});

describe("ListePrestataires (admin)", () => {
  it("affiche « Actif » ou « Désactivé » d'après la base, l'ordre de priorité et la règle de la carte verrouillée", () => {
    rendre(<ListePrestataires prestataires={base} />);
    const kpay = screen.getByRole("heading", { name: "TEST_K-Pay" }).closest("li") as HTMLElement;
    expect(within(kpay).getByText("Actif")).toBeTruthy();
    expect(within(kpay).getByText("Ordre de priorité : 2")).toBeTruthy();
    expect(within(screen.getByRole("heading", { name: "TEST_PawaPay" }).closest("li") as HTMLElement).getByText("Désactivé")).toBeTruthy();
    expect(screen.getByText("Règle de la carte (verrouillée)")).toBeTruthy();
    expect(screen.getByText("K-Pay : paniers avec un produit physique et pass d'événement.")).toBeTruthy();
    expect(screen.getByText("Polar : paniers 100 % kits.")).toBeTruthy();
  });
  it("activer un Prestataire : appelle le serveur puis relit la liste", async () => {
    rendre(<ListePrestataires prestataires={base} />);
    await userEvent.click(screen.getByRole("button", { name: "Activer TEST_PawaPay" }));
    expect(faux.changer).toHaveBeenCalledWith({ code: "pawapay", actif: true });
    await waitFor(() => expect(faux.refresh).toHaveBeenCalled());
  });
  it("désactiver un Prestataire actif", async () => {
    rendre(<ListePrestataires prestataires={base} />);
    await userEvent.click(screen.getByRole("button", { name: "Désactiver TEST_K-Pay" }));
    expect(faux.changer).toHaveBeenCalledWith({ code: "kpay", actif: false });
  });
  it("un Prestataire sans adaptateur ne peut pas être activé : bouton bloqué avec sa raison, aucun appel", async () => {
    rendre(<ListePrestataires prestataires={base} />);
    const bouton = screen.getByRole("button", { name: "Activer TEST_Polar" });
    expect(bouton.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(bouton);
    expect(faux.changer).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Adaptateur pas encore branché/).length).toBeGreaterThan(0);
  });
  it("Monter / Descendre n'existent que pour les Agrégateurs", async () => {
    rendre(<ListePrestataires prestataires={base} />);
    expect(screen.queryByRole("button", { name: "Monter TEST_Polar" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Monter TEST_MaishaPay" }));
    expect(faux.deplacer).toHaveBeenCalledWith({ code: "maishapay", sens: "monter" });
    await userEvent.click(screen.getByRole("button", { name: "Descendre TEST_PawaPay" }));
    expect(faux.deplacer).toHaveBeenCalledWith({ code: "pawapay", sens: "descendre" });
  });
  it("erreur du serveur : message en alerte, la liste est quand même relue", async () => {
    faux.changer.mockResolvedValue({ ok: false, erreur: "non_autorise" });
    rendre(<ListePrestataires prestataires={base} />);
    await userEvent.click(screen.getByRole("button", { name: "Désactiver TEST_K-Pay" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Tu n'as plus le droit de gérer les prestataires");
    expect(faux.refresh).toHaveBeenCalled();
  });
});
