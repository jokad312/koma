// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => {
  const refresh = vi.fn();
  return { creer: vi.fn(), modifier: vi.fn(), refresh, routeur: { refresh } };
});
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => faux.routeur }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("@/modules/promo/actions", () => ({
  creerCodePromoAction: (...a: unknown[]) => faux.creer(...a),
  modifierCodePromoAction: (...a: unknown[]) => faux.modifier(...a),
}));

import { FormulaireCodePromo } from "@/components/admin/FormulaireCodePromo";
import { ListeCodesPromo } from "@/components/admin/ListeCodesPromo";
import type { CodePromo } from "@/modules/promo/types";

const CODE: CodePromo = {
  id: "00000000-0000-4000-8000-0000000000d1",
  code: "SOLDES10",
  affilie: "TEST_Affilié",
  reductionPct: 20,
  commissionPct: 5,
  plafond: 50,
  actif: true,
  creeLe: "2026-11-04T10:00:00Z",
  modifieLe: "2026-11-04T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  faux.creer.mockResolvedValue({ ok: true });
  faux.modifier.mockResolvedValue({ ok: true });
});

async function remplirCreation(valeurs: { code?: string; affilie?: string; reduction?: string; commission?: string; plafond?: string } = {}) {
  const champs = {
    code: valeurs.code ?? "soldes10",
    affilie: valeurs.affilie ?? "TEST_Affilié",
    reduction: valeurs.reduction ?? "20",
    commission: valeurs.commission ?? "5",
    plafond: valeurs.plafond ?? "",
  };
  await userEvent.type(screen.getByLabelText("Code"), champs.code);
  await userEvent.type(screen.getByLabelText("Affilié"), champs.affilie);
  await userEvent.type(screen.getByLabelText("Pourcentage de réduction"), champs.reduction);
  await userEvent.type(screen.getByLabelText("Taux de commission"), champs.commission);
  if (champs.plafond) await userEvent.type(screen.getByLabelText("Plafond d'utilisations"), champs.plafond);
}

describe("FormulaireCodePromo : création", () => {
  it("affiche les champs validés et le plafond vide (50 par défaut côté serveur)", () => {
    rendre(<FormulaireCodePromo />);
    expect(screen.getByRole("heading", { name: "Créer un Code promo" })).toBeTruthy();
    for (const libelle of ["Code", "Affilié", "Pourcentage de réduction", "Taux de commission", "Plafond d'utilisations", "Actif"]) {
      expect(screen.getByLabelText(libelle)).toBeTruthy();
    }
    expect((screen.getByLabelText("Plafond d'utilisations") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Actif") as HTMLInputElement).checked).toBe(true);
  });

  it("envoie la saisie brute au serveur puis vide le formulaire et relit la liste", async () => {
    rendre(<FormulaireCodePromo />);
    await remplirCreation();
    await userEvent.click(screen.getByRole("button", { name: "Créer le Code promo" }));
    expect(faux.creer).toHaveBeenCalledWith({
      code: "soldes10",
      affilie: "TEST_Affilié",
      reductionPct: "20",
      commissionPct: "5",
      plafond: "",
      actif: true,
    });
    await waitFor(() => expect((screen.getByLabelText("Code") as HTMLInputElement).value).toBe(""));
    expect((screen.getByLabelText("Affilié") as HTMLInputElement).value).toBe("");
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("code déjà pris : erreur reliée au champ Code, saisie conservée", async () => {
    faux.creer.mockResolvedValue({ ok: false, erreur: "code_existant" });
    rendre(<FormulaireCodePromo />);
    await remplirCreation();
    await userEvent.click(screen.getByRole("button", { name: "Créer le Code promo" }));
    const champ = await screen.findByLabelText("Code");
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    const idErreur = (champ.getAttribute("aria-describedby") ?? "").split(" ").find((id) => id.endsWith("-erreur"));
    expect(idErreur).toBeTruthy();
    expect(document.getElementById(idErreur as string)?.textContent).toBe("[Texte à fournir]");
    expect((screen.getByLabelText("Affilié") as HTMLInputElement).value).toBe("TEST_Affilié");
  });

  it("droit retiré : message général, aucun champ marqué invalide", async () => {
    faux.creer.mockResolvedValue({ ok: false, erreur: "non_autorise" });
    rendre(<FormulaireCodePromo />);
    await remplirCreation();
    await userEvent.click(screen.getByRole("button", { name: "Créer le Code promo" }));
    expect((await screen.findByRole("alert")).textContent).toContain("[Texte à fournir]");
    expect((screen.getByLabelText("Code") as HTMLInputElement).getAttribute("aria-invalid")).toBeNull();
  });

  it("le succès n'apparaît qu'après la réponse du serveur", async () => {
    rendre(<FormulaireCodePromo />);
    expect(screen.queryByRole("status")).toBeNull();
    await remplirCreation();
    await userEvent.click(screen.getByRole("button", { name: "Créer le Code promo" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("[Texte à fournir]"));
  });
});

describe("ListeCodesPromo", () => {
  it("liste le code, ses valeurs et son état avec les libellés validés", () => {
    rendre(<ListeCodesPromo codes={[CODE]} />);
    expect(screen.getByRole("heading", { name: "SOLDES10" })).toBeTruthy();
    expect(screen.getByText("TEST_Affilié")).toBeTruthy();
    expect(screen.getByText("20 %")).toBeTruthy();
    expect(screen.getByText("5 %")).toBeTruthy();
    expect(screen.getByText("50")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Actif");
  });

  it("état inactif : le texte le dit, jamais la couleur seule", () => {
    rendre(<ListeCodesPromo codes={[{ ...CODE, actif: false }]} />);
    expect(screen.getByRole("status").textContent).toBe("Inactif");
  });

  it("modifier : le code est affiché en lecture seule et les valeurs sont préremplies", async () => {
    rendre(<ListeCodesPromo codes={[CODE]} />);
    await userEvent.click(screen.getByRole("button", { name: "Modifier" }));
    const formulaire = screen.getByRole("heading", { name: "Modifier le Code promo" }).closest("section") as HTMLElement;
    expect(within(formulaire).getByText("SOLDES10")).toBeTruthy();
    expect(within(formulaire).queryByLabelText("Code")).toBeNull();
    expect((within(formulaire).getByLabelText("Affilié") as HTMLInputElement).value).toBe("TEST_Affilié");
    expect((within(formulaire).getByLabelText("Pourcentage de réduction") as HTMLInputElement).value).toBe("20");
    expect((within(formulaire).getByLabelText("Taux de commission") as HTMLInputElement).value).toBe("5");
    expect((within(formulaire).getByLabelText("Plafond d'utilisations") as HTMLInputElement).value).toBe("50");
  });

  it("enregistrer une modification envoie l'identifiant, affiche le succès puis « Annuler » referme", async () => {
    rendre(<ListeCodesPromo codes={[CODE]} />);
    await userEvent.click(screen.getByRole("button", { name: "Modifier" }));
    const plafond = screen.getByLabelText("Plafond d'utilisations");
    await userEvent.clear(plafond);
    await userEvent.type(plafond, "80");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(faux.modifier).toHaveBeenCalledWith(CODE.id, {
      affilie: "TEST_Affilié",
      reductionPct: "20",
      commissionPct: "5",
      plafond: "80",
      actif: true,
    });
    await waitFor(() => {
      const formulaire = screen.getByRole("heading", { name: "Modifier le Code promo" }).closest("section") as HTMLElement;
      expect(within(formulaire).getByRole("status").textContent).toContain("[Texte à fournir]");
    });
    expect(screen.getByRole("heading", { name: "Modifier le Code promo" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Modifier le Code promo" })).toBeNull());
    expect(faux.refresh).toHaveBeenCalled();
  });

  it("liste vide : un texte d'état, aucun élément de liste", () => {
    rendre(<ListeCodesPromo codes={[]} />);
    expect(screen.getByText("[Texte à fournir]")).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
