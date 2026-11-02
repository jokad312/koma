// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";
import { BoutonTelecharger } from "@/components/bibliotheque/BoutonTelecharger";

const FICHIER = "00000000-0000-4000-8000-0000000000c1";
const props = { fichierId: FICHIER, nom: "Patron A4", format: "PDF A4", taille: "2,4 Mo" };
const NOM = "Télécharger Patron A4 (PDF A4, 2,4 Mo)";

const assigner = vi.fn();
const fetchFaux = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchFaux);
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign: assigner } });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function reponse(statut: number, corps: unknown) {
  return { ok: statut >= 200 && statut < 300, status: statut, json: async () => corps };
}

describe("BoutonTelecharger", () => {
  it("demande un lien au serveur, annonce « Préparation du lien… », puis ouvre le lien signé", async () => {
    let finir: (v: unknown) => void = () => undefined;
    fetchFaux.mockReturnValueOnce(new Promise((r) => (finir = r)));
    rendre(<BoutonTelecharger {...props} />);
    await userEvent.click(screen.getByRole("button", { name: NOM }));
    expect((await screen.findAllByText("Préparation du lien…")).length).toBeGreaterThan(0);
    expect(fetchFaux).toHaveBeenCalledWith(`/api/kits/fichier/${FICHIER}`, expect.objectContaining({ cache: "no-store" }));
    finir(reponse(200, { url: "https://TEST.invalid/signe" }));
    await waitFor(() => expect(assigner).toHaveBeenCalledWith("https://TEST.invalid/signe"));
  });

  it("chaque clic demande un nouveau lien", async () => {
    fetchFaux.mockResolvedValue(reponse(200, { url: "https://TEST.invalid/signe" }));
    rendre(<BoutonTelecharger {...props} />);
    await userEvent.click(screen.getByRole("button", { name: NOM }));
    await waitFor(() => expect(assigner).toHaveBeenCalledTimes(1));
    await userEvent.click(await screen.findByRole("button", { name: NOM }));
    await waitFor(() => expect(fetchFaux).toHaveBeenCalledTimes(2));
  });

  it("échec du serveur : « Le téléchargement n'a pas abouti. Réessaie. » en alerte, sans ouvrir de lien", async () => {
    fetchFaux.mockResolvedValue(reponse(500, { erreur: "echec" }));
    rendre(<BoutonTelecharger {...props} />);
    await userEvent.click(screen.getByRole("button", { name: NOM }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toBe("Le téléchargement n'a pas abouti. Réessaie.");
    expect(assigner).not.toHaveBeenCalled();
  });

  it("panne réseau : même message", async () => {
    fetchFaux.mockRejectedValue(new Error("TEST_reseau"));
    rendre(<BoutonTelecharger {...props} />);
    await userEvent.click(screen.getByRole("button", { name: NOM }));
    expect((await screen.findByRole("alert")).textContent).toBe("Le téléchargement n'a pas abouti. Réessaie.");
  });

  it("refus (403) : message d'accès, aucun lien", async () => {
    fetchFaux.mockResolvedValue(reponse(403, { erreur: "refuse" }));
    rendre(<BoutonTelecharger {...props} />);
    await userEvent.click(screen.getByRole("button", { name: NOM }));
    expect((await screen.findByRole("alert")).textContent).toBe("Tu n'as pas accès à ce fichier.");
    expect(assigner).not.toHaveBeenCalled();
  });

  it("session terminée (401) : invitation à se reconnecter", async () => {
    fetchFaux.mockResolvedValue(reponse(401, { erreur: "non_connecte" }));
    rendre(<BoutonTelecharger {...props} />);
    await userEvent.click(screen.getByRole("button", { name: NOM }));
    expect((await screen.findByRole("alert")).textContent).toBe("Ta session a pris fin. Connecte-toi à nouveau.");
  });
});
