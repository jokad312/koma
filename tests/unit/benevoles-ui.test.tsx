// @vitest-environment jsdom
// Story 7.7 : section « Bénévoles » de la page d'un Événement. Champ email relié à son erreur, état « sans compte », succès seulement après la réponse
// réelle du serveur, liste des accès (email, jour, statut), retrait, aucun accès d'un autre Événement. Actions serveur simulées (données TEST_).
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ donner: vi.fn(), retirer: vi.fn(), refresh: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/benevoles/actions", () => ({
  donnerAccesBenevoleAction: (...a: unknown[]) => faux.donner(...a),
  retirerAccesBenevoleAction: (...a: unknown[]) => faux.retirer(...a),
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: faux.refresh, push: vi.fn() }), Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

import { SectionBenevoles } from "@/components/admin/SectionBenevoles";
import type { AccesBenevole } from "@/modules/benevoles/types";

const M = fr.Admin.evenements.benevoles;
const EVENEMENT = "00000000-0000-4000-8000-0000000000e1";
const ACCES: AccesBenevole = {
  id: "00000000-0000-4000-8000-0000000000a1",
  email: "test.benevole@example.invalid",
  valableDu: "2099-03-09T22:00:00Z",
  valableJusquAu: "2099-03-10T22:00:00Z",
  etat: "avenir",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("section Bénévoles", () => {
  it("titre, aide, prérequis (Compte créé par code email) et champ email nommé", () => {
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[]} />);
    expect(screen.getByRole("heading", { name: M.titre })).toBeTruthy();
    expect(screen.getByText(M.prerequis)).toBeTruthy();
    const champ = screen.getByLabelText(M.champ.libelle) as HTMLInputElement;
    expect(champ.type).toBe("email");
    expect(champ.required).toBe(true);
    expect(champ.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByRole("button", { name: M.donner }).className).toContain("min-h-touch");
    expect(screen.getByText(M.liste.vide)).toBeTruthy();
  });

  it("envoie l'Événement et l'email, confirme seulement après la réponse du serveur, vide le champ et rafraîchit", async () => {
    faux.donner.mockResolvedValue({ statut: "succes", resultat: "attribue", email: "test.benevole@example.invalid" });
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[]} />);
    const champ = screen.getByLabelText(M.champ.libelle) as HTMLInputElement;
    await userEvent.type(champ, "test.benevole@example.invalid");
    expect(screen.queryByText(/Accès donné à/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: M.donner }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Accès donné à test.benevole@example.invalid."));
    const formData = faux.donner.mock.calls[0][1] as FormData;
    expect(formData.get("evenementId")).toBe(EVENEMENT);
    expect(formData.get("email")).toBe("test.benevole@example.invalid");
    expect(champ.value).toBe("");
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("aucun compte pour cet email : le dit clairement, garde la saisie, ne rafraîchit pas", async () => {
    faux.donner.mockResolvedValue({ statut: "succes", resultat: "sans_compte", email: "inconnu@example.invalid" });
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[]} />);
    await userEvent.type(screen.getByLabelText(M.champ.libelle), "inconnu@example.invalid");
    await userEvent.click(screen.getByRole("button", { name: M.donner }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(M.sansCompte));
    expect(M.sansCompte).toContain("créer son Compte par code email");
    expect((screen.getByLabelText(M.champ.libelle) as HTMLInputElement).value).toBe("inconnu@example.invalid");
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("déjà donné : message dédié", async () => {
    faux.donner.mockResolvedValue({ statut: "succes", resultat: "deja", email: "test.benevole@example.invalid" });
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[ACCES]} />);
    await userEvent.type(screen.getByLabelText(M.champ.libelle), "test.benevole@example.invalid");
    await userEvent.click(screen.getByRole("button", { name: M.donner }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("a déjà cet accès"));
  });

  it("email invalide : l'erreur est reliée au champ (aria-invalid, aria-describedby), annoncée, focus sur le champ, saisie gardée", async () => {
    faux.donner.mockResolvedValue({ statut: "erreur", erreur: "email_invalide", email: "abc@x" });
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[]} />);
    const champ = screen.getByLabelText(M.champ.libelle) as HTMLInputElement;
    await userEvent.type(champ, "abc@x");
    await userEvent.click(screen.getByRole("button", { name: M.donner }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toBe(M.erreurs.email_invalide);
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(champ.getAttribute("aria-describedby")).toContain(alerte.id);
    expect(document.activeElement).toBe(champ);
    expect(champ.value).toBe("abc@x");
  });

  it("refus (plus de droit) : message d'erreur, aucun succès affiché", async () => {
    faux.donner.mockResolvedValue({ statut: "erreur", erreur: "non_autorise", email: "a@example.invalid" });
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[]} />);
    await userEvent.type(screen.getByLabelText(M.champ.libelle), "a@example.invalid");
    await userEvent.click(screen.getByRole("button", { name: M.donner }));
    expect((await screen.findByRole("alert")).textContent).toContain(M.erreurs.non_autorise);
    expect(screen.queryByText(/Accès donné à/)).toBeNull();
  });

  it("l'aide dit que, sans heure de fin, l'accès s'arrête à minuit le jour du début", () => {
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[]} />);
    expect(screen.getByText(M.aideFin)).toBeTruthy();
    expect(M.aideFin).toContain("Sans heure de fin");
    expect(fr.Admin.evenements.benevoles.liste).not.toHaveProperty("retraitEnCours");
  });

  it("liste : email, jour de l'Événement, statut, bouton Retirer nommé par l'email (44 px)", () => {
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[ACCES, { ...ACCES, id: "autre", email: "deux@example.invalid", etat: "valide" }]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText(ACCES.email)).toBeTruthy();
    expect(items[0].textContent).toContain("10 mars 2099");
    expect(items[0].textContent).not.toContain("9 mars");
    expect(items[0].textContent).toContain(M.liste.avenir);
    expect(items[1].textContent).toContain(M.liste.valide);
    const bouton = within(items[0]).getByRole("button", { name: `Retirer l'accès de ${ACCES.email}` });
    expect(bouton.className).toContain("min-h-touch");
  });

  it("accès échu non encore supprimé : « Terminé »", () => {
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[{ ...ACCES, valableDu: "2020-03-09T22:00:00Z", valableJusquAu: "2020-03-10T22:00:00Z", etat: "termine" }]} />);
    expect(screen.getByRole("listitem").textContent).toContain(M.liste.termine);
  });

  it("événement sur plusieurs jours : « Du … au … »", () => {
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[{ ...ACCES, valableDu: "2099-03-31T22:00:00Z", valableJusquAu: "2099-04-03T22:00:00Z" }]} />);
    expect(screen.getByRole("listitem").textContent).toContain("Du 1 avril 2099 au 3 avril 2099");
  });

  it("retirer : appelle l'action pour CET Événement, confirme après la réponse, rafraîchit", async () => {
    faux.retirer.mockResolvedValue({ statut: "succes", retire: true });
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[ACCES]} />);
    await userEvent.click(screen.getByRole("button", { name: `Retirer l'accès de ${ACCES.email}` }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(M.liste.retire));
    expect(faux.retirer).toHaveBeenCalledWith({ evenementId: EVENEMENT, accesId: ACCES.id });
    expect(faux.refresh).toHaveBeenCalled();
    // Le focus revient à un élément stable : le champ email.
    expect(document.activeElement).toBe(screen.getByLabelText(M.champ.libelle));
  });

  it("retrait refusé : erreur affichée, pas de rafraîchissement", async () => {
    faux.retirer.mockResolvedValue({ statut: "erreur", erreur: "non_autorise" });
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[ACCES]} />);
    await userEvent.click(screen.getByRole("button", { name: `Retirer l'accès de ${ACCES.email}` }));
    expect((await screen.findByRole("alert")).textContent).toContain(M.erreurs.non_autorise);
    expect(faux.refresh).not.toHaveBeenCalled();
  });

  it("anglais : mêmes clés, textes anglais", () => {
    rendre(<SectionBenevoles evenementId={EVENEMENT} acces={[]} />, "en");
    expect(screen.getByRole("heading", { name: "Entrance volunteers" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Give access" })).toBeTruthy();
  });
});
