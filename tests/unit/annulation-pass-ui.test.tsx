// @vitest-environment jsdom
// Story 7.9 : bouton « Demander l'annulation » de la carte Pass. Confirmation avant envoi, frais rappelés, Stand signalé, demande en cours.
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ action: vi.fn(), refresh: vi.fn() }));
vi.mock("@/modules/evenements/annulation-actions", () => ({ demanderAnnulationPassAction: faux.action }));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ refresh: faux.refresh }) }));

import { DemanderAnnulationPass } from "@/components/compte/DemanderAnnulationPass";

const PASS = "00000000-0000-4000-8000-0000000000f1";
const possible = { possible: true, fraisPct: 20, stand: false, demande: null } as const;

describe("DemanderAnnulationPass", () => {
  beforeEach(() => {
    faux.action.mockReset().mockResolvedValue({ ok: true });
    faux.refresh.mockReset();
  });

  it("n'envoie rien avant la confirmation, qui rappelle les frais retenus", async () => {
    const u = userEvent.setup();
    rendre(<DemanderAnnulationPass passId={PASS} annulation={possible} />);
    await u.click(screen.getByRole("button", { name: "Demander l'annulation" }));
    expect(faux.action).not.toHaveBeenCalled();
    expect(screen.getByText(/frais d'annulation de 20 %/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Oui, demander l'annulation" }));
    expect(faux.action).toHaveBeenCalledWith({ passId: PASS });
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(faux.refresh).toHaveBeenCalled();
  });
  it("« Non, garder mon Pass » referme sans rien envoyer", async () => {
    const u = userEvent.setup();
    rendre(<DemanderAnnulationPass passId={PASS} annulation={possible} />);
    await u.click(screen.getByRole("button", { name: "Demander l'annulation" }));
    await u.click(screen.getByRole("button", { name: "Non, garder mon Pass" }));
    expect(screen.getByRole("button", { name: "Demander l'annulation" })).toBeTruthy();
    expect(faux.action).not.toHaveBeenCalled();
  });
  it("Stand : prévient que l'autre titulaire est annulé aussi", async () => {
    const u = userEvent.setup();
    rendre(<DemanderAnnulationPass passId={PASS} annulation={{ ...possible, stand: true }} />);
    await u.click(screen.getByRole("button", { name: "Demander l'annulation" }));
    expect(screen.getByText(/l'autre titulaire du Stand/)).toBeTruthy();
  });
  it("erreur de la base : message clair et le bouton reste disponible", async () => {
    faux.action.mockResolvedValue({ ok: false, erreur: "impossible" });
    const u = userEvent.setup();
    rendre(<DemanderAnnulationPass passId={PASS} annulation={possible} />);
    await u.click(screen.getByRole("button", { name: "Demander l'annulation" }));
    await u.click(screen.getByRole("button", { name: "Oui, demander l'annulation" }));
    expect(await screen.findByText(/ne peut plus être annulé/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Demander l'annulation" })).toBeTruthy();
  });
  it("demande en cours : aucun bouton, un état annoncé", () => {
    rendre(<DemanderAnnulationPass passId={PASS} annulation={{ ...possible, possible: false, demande: "ouverte" }} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/Demande d'annulation en cours/);
  });
  it("frais inconnus : jamais de bouton", () => {
    rendre(<DemanderAnnulationPass passId={PASS} annulation={{ possible: true, fraisPct: null, stand: false, demande: null }} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("demande refusée : le dit, et propose de nouveau si le Pass reste annulable", () => {
    rendre(<DemanderAnnulationPass passId={PASS} annulation={{ ...possible, demande: "refusee" }} />);
    expect(screen.getByText(/a été refusée/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Demander l'annulation" })).toBeTruthy();
  });
});
