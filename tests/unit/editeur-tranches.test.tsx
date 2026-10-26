// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const enregistrerTranchesPrix = vi.fn();
const enregistrerReglage = vi.fn();
vi.mock("@/modules/admin/actions", () => ({
  enregistrerReglage: (...a: unknown[]) => enregistrerReglage(...a),
}));
vi.mock("@/modules/catalogue/actions", () => ({
  enregistrerTranchesPrix: (...a: unknown[]) => enregistrerTranchesPrix(...a),
}));

import { EditeurTranchesPrix } from "@/components/admin/EditeurTranchesPrix";
import { FormulaireReglage } from "@/components/admin/FormulaireReglage";

const DEUX = [
  { ordre: 1, libelleFr: "Petit", libelleEn: "Small", basCents: 0, hautCents: 2000 },
  { ordre: 2, libelleFr: "Grand", libelleEn: "Large", basCents: 2000, hautCents: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditeurTranchesPrix", () => {
  it("aucune tranche : « Valeur à fixer », aucune tranche inventée", () => {
    rendre(<EditeurTranchesPrix tranches={[]} />);
    expect(screen.getByText("Valeur à fixer")).toBeTruthy();
    expect(screen.getByText("Aucune tranche pour le moment.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Tranches de prix" })).toBeNull();
  });

  it("tranches existantes : champs remplis en USD", () => {
    rendre(<EditeurTranchesPrix tranches={DEUX} />);
    expect(screen.getByText("Tranches enregistrées : 2")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Tranche 1 : libellé en français" }) as HTMLInputElement).value).toBe("Petit");
    expect((screen.getByRole("textbox", { name: "Tranche 1 : borne haute (USD)" }) as HTMLInputElement).value).toBe("20");
    expect((screen.getByRole("textbox", { name: "Tranche 2 : borne haute (USD)" }) as HTMLInputElement).value).toBe("");
  });

  it("Monter / Descendre : noms complets, aria-disabled en bout, l'ordre change", async () => {
    const user = userEvent.setup();
    rendre(<EditeurTranchesPrix tranches={DEUX} />);
    expect(screen.getByRole("button", { name: "Monter la tranche 1" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Descendre la tranche 2" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Monter la tranche 2" }).getAttribute("aria-disabled")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Monter la tranche 2" }));
    expect((screen.getByRole("textbox", { name: "Tranche 1 : libellé en français" }) as HTMLInputElement).value).toBe("Grand");
    expect(screen.getByRole("status").textContent).toBe("Tranche déplacée à la position 1.");
  });

  it("Ajouter jusqu'à 8, puis le bouton est désactivé ; Retirer enlève la ligne", async () => {
    const user = userEvent.setup();
    rendre(<EditeurTranchesPrix tranches={[]} />);
    const ajouter = screen.getByRole("button", { name: "Ajouter une tranche" });
    for (let i = 0; i < 8; i += 1) await user.click(ajouter);
    expect(within(screen.getByRole("list", { name: "Tranches de prix" })).getAllByRole("listitem")).toHaveLength(8);
    expect(ajouter.getAttribute("aria-disabled")).toBe("true");
    await user.click(ajouter);
    expect(within(screen.getByRole("list", { name: "Tranches de prix" })).getAllByRole("listitem")).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "Retirer la tranche 8" }));
    expect(within(screen.getByRole("list", { name: "Tranches de prix" })).getAllByRole("listitem")).toHaveLength(7);
  });

  it("le succès n'apparaît qu'après la réponse réelle ; la liste envoyée est celle de l'écran", async () => {
    let repondre: (v: unknown) => void = () => {};
    enregistrerTranchesPrix.mockImplementation(() => new Promise((resolve) => (repondre = resolve)));
    const user = userEvent.setup();
    rendre(<EditeurTranchesPrix tranches={DEUX} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer les tranches" }));

    expect(await screen.findByRole("button", { name: "Enregistrement…" })).toBeTruthy();
    expect(screen.queryByText("Tranches enregistrées.")).toBeNull();
    expect(enregistrerTranchesPrix).toHaveBeenCalledWith([
      { libelleFr: "Petit", libelleEn: "Small", bas: "0", haut: "20" },
      { libelleFr: "Grand", libelleEn: "Large", bas: "20", haut: "" },
    ]);

    await act(async () => repondre({ statut: "succes" }));
    expect(await screen.findByText("Tranches enregistrées.")).toBeTruthy();
  });

  it("erreur de tranche : résumé role=alert, champ marqué et relié, saisie conservée, aucun succès", async () => {
    enregistrerTranchesPrix.mockResolvedValue({ statut: "erreur", erreur: "tranche_bornes_invalides", ligne: 2, champ: "bas" });
    const user = userEvent.setup();
    rendre(<EditeurTranchesPrix tranches={DEUX} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer les tranches" }));

    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toMatch(/^Tranche 2 : les bornes doivent être/);
    const champ = screen.getByRole("textbox", { name: "Tranche 2 : borne basse (USD)" }) as HTMLInputElement;
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(champ.getAttribute("aria-describedby")).toContain("-erreur");
    expect(champ.value).toBe("20");
    expect(screen.queryByText("Tranches enregistrées.")).toBeNull();
  });

  it("échec serveur : message générique, saisie conservée", async () => {
    enregistrerTranchesPrix.mockResolvedValue({ statut: "erreur", erreur: "generique" });
    const user = userEvent.setup();
    rendre(<EditeurTranchesPrix tranches={DEUX} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer les tranches" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/n'ont pas pu être enregistrées/);
    expect((screen.getByRole("textbox", { name: "Tranche 1 : libellé en français" }) as HTMLInputElement).value).toBe("Petit");
  });

  it("focus : Ajouter va au premier champ de la nouvelle ligne ; Retirer va à la ligne suivante, sinon à Ajouter", async () => {
    const user = userEvent.setup();
    rendre(<EditeurTranchesPrix tranches={DEUX} />);
    await user.click(screen.getByRole("button", { name: "Ajouter une tranche" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Tranche 3 : libellé en français" }));
    await user.click(screen.getByRole("button", { name: "Retirer la tranche 1" }));
    // La ligne suivante prend le rang 1 : c'est son bouton Retirer qui reçoit le focus.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Retirer la tranche 1" }));
    await user.click(screen.getByRole("button", { name: "Retirer la tranche 1" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Retirer la tranche 1" }));
    await user.click(screen.getByRole("button", { name: "Retirer la tranche 1" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ajouter une tranche" }));
  });

  it("focus : après un échec d'enregistrement, le résumé d'erreur", async () => {
    enregistrerTranchesPrix.mockResolvedValue({ statut: "erreur", erreur: "generique" });
    const user = userEvent.setup();
    rendre(<EditeurTranchesPrix tranches={DEUX} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer les tranches" }));
    expect(document.activeElement).toBe(await screen.findByRole("alert"));
  });

  it("existe en anglais", () => {
    rendre(<EditeurTranchesPrix tranches={[]} />, "en");
    expect(screen.getByRole("button", { name: "Add a range" })).toBeTruthy();
    expect(screen.getByText("Value to set")).toBeTruthy();
  });
});

describe("FormulaireReglage : forfait, retrait, plafond", () => {
  it("forfait jamais saisi : « Valeur à fixer », champ vide", () => {
    rendre(<FormulaireReglage cle="forfait_livraison_goma_cents" valeur={null} />);
    expect(screen.getByText("Valeur à fixer")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Forfait de livraison à Goma (USD)" }) as HTMLInputElement).value).toBe("");
  });

  it("forfait enregistré en centimes : montré en USD dans le champ et en texte", () => {
    rendre(<FormulaireReglage cle="forfait_livraison_goma_cents" valeur="550" />);
    expect((screen.getByRole("textbox", { name: "Forfait de livraison à Goma (USD)" }) as HTMLInputElement).value).toBe("5.50");
    expect(screen.getByText(/Valeur actuelle : 5,50/)).toBeTruthy();
  });

  it("forfait 0 : montré comme une valeur (gratuit), pas comme « Valeur à fixer »", () => {
    rendre(<FormulaireReglage cle="forfait_livraison_bukavu_cents" valeur="0" />);
    expect(screen.queryByText("Valeur à fixer")).toBeNull();
    expect((screen.getByRole("textbox", { name: "Forfait de livraison à Bukavu (USD)" }) as HTMLInputElement).value).toBe("0");
  });

  it("forfait invalide : erreur sous le champ, saisie telle que tapée conservée", async () => {
    enregistrerReglage.mockResolvedValue({ statut: "erreur", cle: "forfait_livraison_goma_cents", erreur: "forfait_goma_invalide", valeur: "5,555" });
    const user = userEvent.setup();
    rendre(<FormulaireReglage cle="forfait_livraison_goma_cents" valeur={null} />);
    await user.type(screen.getByRole("textbox", { name: "Forfait de livraison à Goma (USD)" }), "5,555");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toMatch(/forfait de Goma/);
    const champ = screen.getByRole("textbox", { name: "Forfait de livraison à Goma (USD)" }) as HTMLInputElement;
    expect(champ.value).toBe("5,555");
    expect(champ.getAttribute("aria-describedby")).toContain(alerte.id);
  });

  it("forfait enregistré : succès seulement après la réponse, valeur en USD", async () => {
    enregistrerReglage.mockResolvedValue({ statut: "succes", cle: "forfait_livraison_goma_cents", valeur: "550" });
    const user = userEvent.setup();
    rendre(<FormulaireReglage cle="forfait_livraison_goma_cents" valeur={null} />);
    await user.type(screen.getByRole("textbox", { name: "Forfait de livraison à Goma (USD)" }), "5,50");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Réglage enregistré.")).toBeTruthy();
    expect(screen.getByText(/Valeur actuelle : 5,50/)).toBeTruthy();
  });

  it("retrait : zone de texte à libellé visible ; plafond : champ numérique", () => {
    rendre(
      <>
        <FormulaireReglage cle="retrait_goma_fr" valeur="Texte de test" />
        <FormulaireReglage cle="plafond_fabrication" valeur="40" />
      </>,
    );
    const retrait = screen.getByRole("textbox", { name: "Lieu de retrait gratuit à Goma, en français" });
    expect(retrait.tagName).toBe("TEXTAREA");
    expect((retrait as HTMLTextAreaElement).value).toBe("Texte de test");
    expect(screen.getByRole("textbox", { name: "Plafond de fabrication (pièces)" }).getAttribute("inputmode")).toBe("numeric");
  });
});
