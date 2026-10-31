// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  lireEtatKit: vi.fn(),
  obtenirKitGratuit: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/fr/kits/test-kit" }));
vi.mock("@/modules/bibliotheque/actions", () => ({ lireEtatKit: (...a: unknown[]) => faux.lireEtatKit(...a) }));
vi.mock("@/modules/commande/actions", () => ({ obtenirKitGratuit: (...a: unknown[]) => faux.obtenirKitGratuit(...a) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { ObtentionKit } from "@/components/fiche/ObtentionKit";

const KIT = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ObtentionKit", () => {
  it("visiteur non connecté : lien vers la connexion avec retour sur la fiche (UX-DR26)", async () => {
    faux.lireEtatKit.mockResolvedValue("anonyme");
    rendre(<ObtentionKit produitId={KIT} prixCents={0} />);
    const lien = await screen.findByRole("link", { name: "Obtenir le kit gratuit" });
    expect(lien.getAttribute("href")).toBe(`/connexion?retour=${encodeURIComponent("/fr/kits/test-kit")}`);
  });

  it("Compte complet : le bouton est bloqué tant que la Licence n'est pas cochée, avec sa raison", async () => {
    faux.lireEtatKit.mockResolvedValue("pret");
    rendre(<ObtentionKit produitId={KIT} prixCents={0} />);
    const bouton = await screen.findByRole("button", { name: "Obtenir le kit gratuit" });
    expect(bouton.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Coche d'abord la case de la Licence de kit.")).toBeTruthy();
    await userEvent.click(bouton);
    expect(faux.obtenirKitGratuit).not.toHaveBeenCalled();
  });

  it("Licence cochée : un geste obtient le Kit, puis « Ouvrir dans ma bibliothèque » avec le numéro de Commande", async () => {
    faux.lireEtatKit.mockResolvedValue("pret");
    faux.obtenirKitGratuit.mockResolvedValue({ ok: true, numero: "KS-2026-000042" });
    rendre(<ObtentionKit produitId={KIT} prixCents={0} />);
    await userEvent.click(await screen.findByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Obtenir le kit gratuit" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Ouvrir dans ma bibliothèque" })).toBeTruthy());
    expect(screen.getByText("Ton kit est ouvert. Commande KS-2026-000042.")).toBeTruthy();
    expect(faux.obtenirKitGratuit).toHaveBeenCalledTimes(1);
    expect(faux.obtenirKitGratuit).toHaveBeenCalledWith({ produitId: KIT, licenceAcceptee: true, cleIdempotence: expect.any(String) });
  });

  it("une erreur est annoncée, jamais un faux succès, et la même clé est renvoyée au second essai", async () => {
    faux.lireEtatKit.mockResolvedValue("pret");
    faux.obtenirKitGratuit.mockResolvedValue({ ok: false, erreur: "erreur" });
    rendre(<ObtentionKit produitId={KIT} prixCents={0} />);
    await userEvent.click(await screen.findByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Obtenir le kit gratuit" }));
    await screen.findByText("Le kit n'a pas pu être ouvert. Réessaie.");
    expect(screen.queryByRole("link", { name: "Ouvrir dans ma bibliothèque" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Obtenir le kit gratuit" }));
    await waitFor(() => expect(faux.obtenirKitGratuit).toHaveBeenCalledTimes(2));
    const [premier, second] = faux.obtenirKitGratuit.mock.calls.map((c) => (c[0] as { cleIdempotence: string }).cleIdempotence);
    expect(premier).toBe(second);
  });

  it("Kit déjà possédé (gratuit ou payant) : « Ouvrir dans ma bibliothèque »", async () => {
    faux.lireEtatKit.mockResolvedValue("possede");
    rendre(<ObtentionKit produitId={KIT} prixCents={990} />);
    expect(await screen.findByRole("link", { name: "Ouvrir dans ma bibliothèque" })).toBeTruthy();
  });

  it("Kit payant non possédé : rien (l'achat arrive à l'epic 4)", async () => {
    faux.lireEtatKit.mockResolvedValue("pret");
    const { container } = rendre(<ObtentionKit produitId={KIT} prixCents={990} />);
    await waitFor(() => expect(faux.lireEtatKit).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("l'état est lu après l'affichage, avec l'identifiant du Kit", async () => {
    faux.lireEtatKit.mockResolvedValue("anonyme");
    rendre(<ObtentionKit produitId={KIT} prixCents={0} />);
    await waitFor(() => expect(faux.lireEtatKit).toHaveBeenCalledWith(KIT));
  });
});

describe("ObtentionKit : cas limites de la revue", () => {
  it("Compte incomplet : lien de connexion (qui demande l'âge) avec retour", async () => {
    faux.lireEtatKit.mockResolvedValue("incomplet");
    rendre(<ObtentionKit produitId={KIT} prixCents={0} />);
    const lien = await screen.findByRole("link", { name: "Obtenir le kit gratuit" });
    expect(lien.getAttribute("href")).toContain("/connexion?retour=");
  });

  it("session expirée au clic : message, puis le lien de connexion revient", async () => {
    faux.lireEtatKit.mockResolvedValue("pret");
    faux.obtenirKitGratuit.mockResolvedValue({ ok: false, erreur: "non_connecte" });
    rendre(<ObtentionKit produitId={KIT} prixCents={0} />);
    await userEvent.click(await screen.findByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Obtenir le kit gratuit" }));
    expect(await screen.findByRole("link", { name: "Obtenir le kit gratuit" })).toBeTruthy();
  });

  it("Kit déjà possédé au moment du clic : bascule sur « Ouvrir dans ma bibliothèque »", async () => {
    faux.lireEtatKit.mockResolvedValue("pret");
    faux.obtenirKitGratuit.mockResolvedValue({ ok: false, erreur: "deja_possede" });
    rendre(<ObtentionKit produitId={KIT} prixCents={0} />);
    await userEvent.click(await screen.findByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Obtenir le kit gratuit" }));
    expect(await screen.findByRole("link", { name: "Ouvrir dans ma bibliothèque" })).toBeTruthy();
  });

  it("au succès, le focus passe au message de confirmation", async () => {
    faux.lireEtatKit.mockResolvedValue("pret");
    faux.obtenirKitGratuit.mockResolvedValue({ ok: true, numero: "KS-2026-000042" });
    rendre(<ObtentionKit produitId={KIT} prixCents={0} />);
    await userEvent.click(await screen.findByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Obtenir le kit gratuit" }));
    const message = await screen.findByText("Ton kit est ouvert. Commande KS-2026-000042.");
    await waitFor(() => expect(document.activeElement).toBe(message.closest("[tabindex='-1']")));
  });
});
