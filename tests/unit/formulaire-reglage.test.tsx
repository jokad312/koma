// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const enregistrerReglage = vi.fn();
vi.mock("@/modules/admin/actions", () => ({
  enregistrerReglage: (...a: unknown[]) => enregistrerReglage(...a),
}));

import { FormulaireReglage } from "@/components/admin/FormulaireReglage";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FormulaireReglage", () => {
  it("valeur absente : « Valeur à fixer », aucune valeur de repli", () => {
    rendre(<FormulaireReglage cle="numero_whatsapp" valeur={null} />);
    expect(screen.getByText("Valeur à fixer")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Numéro WhatsApp" }) as HTMLInputElement).value).toBe("");
  });

  it("valeur présente : affichée dans le champ et en texte", () => {
    rendre(<FormulaireReglage cle="nom_site" valeur="Nom de test" />);
    expect((screen.getByRole("textbox", { name: "Nom du site" }) as HTMLInputElement).value).toBe("Nom de test");
    expect(screen.getByText("Valeur actuelle : Nom de test")).toBeTruthy();
  });

  it("le succès n'apparaît qu'après la réponse réelle de l'action", async () => {
    let repondre: (v: unknown) => void = () => {};
    enregistrerReglage.mockImplementation(() => new Promise((resolve) => (repondre = resolve)));
    const user = userEvent.setup();
    rendre(<FormulaireReglage cle="numero_whatsapp" valeur={null} />);

    const champ = screen.getByRole("textbox", { name: "Numéro WhatsApp" });
    await user.type(champ, "+243 970 000 000");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    // L'action n'a pas répondu : ni message de succès, ni valeur actuelle changée.
    expect(await screen.findByRole("button", { name: "Enregistrement…" })).toBeTruthy();
    expect(screen.queryByText("Réglage enregistré.")).toBeNull();
    expect(screen.getByText("Valeur à fixer")).toBeTruthy();

    await act(async () => repondre({ statut: "succes", cle: "numero_whatsapp", valeur: "+243970000000" }));
    expect(await screen.findByText("Réglage enregistré.")).toBeTruthy();
    expect(screen.getByText("Valeur actuelle : +243970000000")).toBeTruthy();
    // Le champ est resté monté (même nœud) : le focus n'est pas perdu.
    expect(screen.getByRole("textbox", { name: "Numéro WhatsApp" })).toBe(champ);
    expect((screen.getByRole("textbox", { name: "Numéro WhatsApp" }) as HTMLInputElement).value).toBe("+243970000000");
  });

  it("erreur de champ : message sous le champ relié par aria-describedby, saisie conservée, aucun succès", async () => {
    enregistrerReglage.mockResolvedValue({ statut: "erreur", cle: "numero_whatsapp", erreur: "numero_invalide", valeur: "abc" });
    const user = userEvent.setup();
    rendre(<FormulaireReglage cle="numero_whatsapp" valeur={null} />);

    await user.type(screen.getByRole("textbox", { name: "Numéro WhatsApp" }), "abc");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    const alerte = await screen.findByRole("alert");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Numéro WhatsApp" }));
    expect(alerte.textContent).toBe("Le numéro doit commencer par + et contenir de 8 à 15 chiffres.");
    const champ = screen.getByRole("textbox", { name: "Numéro WhatsApp" }) as HTMLInputElement;
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(champ.getAttribute("aria-describedby")).toContain(alerte.id);
    expect(champ.value).toBe("abc");
    expect(screen.queryByText("Réglage enregistré.")).toBeNull();
  });

  it("échec serveur : message d'erreur, saisie conservée, aucun succès", async () => {
    enregistrerReglage.mockResolvedValue({ statut: "erreur", cle: "nom_site", erreur: "generique", valeur: "Autre nom" });
    const user = userEvent.setup();
    rendre(<FormulaireReglage cle="nom_site" valeur="Nom de test" />);

    const champ = screen.getByRole("textbox", { name: "Nom du site" }) as HTMLInputElement;
    await user.clear(champ);
    await user.type(champ, "Autre nom");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText(/n'a pas pu être enregistré/)).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Nom du site" }) as HTMLInputElement).value).toBe("Autre nom");
    expect(screen.queryByText("Réglage enregistré.")).toBeNull();
    expect(screen.getByText("Valeur actuelle : Nom de test")).toBeTruthy();
  });

  it("existe en anglais", () => {
    rendre(<FormulaireReglage cle="numero_whatsapp" valeur={null} />, "en");
    expect(screen.getByText("Value to set")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });
});
