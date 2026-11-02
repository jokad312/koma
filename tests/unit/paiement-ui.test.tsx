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
vi.mock("next-intl/server", async () => {
  const fr = (await import("../../messages/fr.json")).default as Record<string, unknown>;
  const { createTranslator } = await import("next-intl");
  return { getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({ locale: "fr", messages: fr as never, namespace: namespace as never }) };
});

import { ListePrestataires, type PrestataireAdmin } from "@/components/admin/ListePrestataires";
import { MoyensPaiement } from "@/components/commande/MoyensPaiement";

const base: PrestataireAdmin[] = [
  { code: "pawapay", nom: "TEST_PawaPay", type: "agregateur", mobileMoney: true, carte: false, actif: false, ordre: 1, adaptateurBranche: true },
  { code: "kpay", nom: "TEST_K-Pay", type: "agregateur", mobileMoney: true, carte: true, actif: true, ordre: 2, adaptateurBranche: true },
  { code: "maishapay", nom: "TEST_MaishaPay", type: "agregateur", mobileMoney: true, carte: false, actif: false, ordre: 3, adaptateurBranche: false },
  { code: "polar", nom: "TEST_Polar", type: "carte", mobileMoney: false, carte: true, actif: false, ordre: null, adaptateurBranche: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  faux.changer.mockResolvedValue({ ok: true });
  faux.deplacer.mockResolvedValue({ ok: true });
});

describe("MoyensPaiement (Récapitulatif)", () => {
  it("sans Couverture ni carte autorisée : les deux messages d'indisponibilité, sans substitution", async () => {
    rendre(await MoyensPaiement({ locale: "fr", options: { carte: { disponible: false }, mobileMoney: { disponible: false } } }));
    expect(screen.getByText("Le mobile money n'est pas encore disponible dans ton pays.")).toBeTruthy();
    expect(screen.getByText("Le paiement par carte n'est pas disponible pour le moment.")).toBeTruthy();
  });
  it("carte autorisée : « Paiement traité par {Prestataire} » en texte, sans logo ni image", async () => {
    const { container } = rendre(await MoyensPaiement({ locale: "fr", options: { carte: { disponible: true, prestataire: { code: "kpay", nom: "TEST_K-Pay" } }, mobileMoney: { disponible: false } } }));
    expect(screen.getByText("Paiement traité par TEST_K-Pay")).toBeTruthy();
    expect(screen.queryByText("Le paiement par carte n'est pas disponible pour le moment.")).toBeNull();
    expect(container.querySelector("img, svg")).toBeNull();
  });
  it("mobile money autorisé : le message d'indisponibilité disparaît", async () => {
    rendre(await MoyensPaiement({ locale: "fr", options: { carte: { disponible: false }, mobileMoney: { disponible: true } } }));
    expect(screen.queryByText("Le mobile money n'est pas encore disponible dans ton pays.")).toBeNull();
  });
  it("aucun bouton de paiement tant qu'aucun adaptateur n'existe", async () => {
    rendre(await MoyensPaiement({ locale: "fr", options: { carte: { disponible: true, prestataire: { code: "kpay", nom: "TEST_K-Pay" } }, mobileMoney: { disponible: true } } }));
    expect(screen.queryByRole("button")).toBeNull();
  });
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
