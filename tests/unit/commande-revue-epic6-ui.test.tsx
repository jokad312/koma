// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({ refresh: vi.fn(), avancer: vi.fn(), rembourser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ refresh: faux.refresh }) }));
vi.mock("@/modules/commande/admin-actions", () => ({
  avancerStatutCommandeAction: (...a: unknown[]) => faux.avancer(...a),
  confirmerRemboursementAction: (...a: unknown[]) => faux.rembourser(...a),
  traiterDemandeAction: vi.fn(),
}));

import { AvancementCommande } from "@/components/admin/AvancementCommande";
import { FormulaireRemboursement } from "@/components/admin/DemandeEtRemboursement";
import { FriseStatuts } from "@/components/commande/FriseStatuts";
import { construireFrise } from "@/modules/commande/frise";
import { transitionsPossibles } from "@/modules/commande/transitions";

beforeEach(() => vi.clearAllMocks());

describe("AvancementCommande (story 6.3 / 6.5)", () => {
  it("une transition interdite est ABSENTE, pas désactivée", () => {
    rendre(<AvancementCommande numero="KS-2026-000042" transitions={["livree"]} mesuresManquantes={false} retrait={false} />);
    expect(screen.getByRole("button", { name: "Marquer comme livrée" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /fabrication/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /expédi/i })).toBeNull();
  });
  it("« Passer en fabrication » : inactif avec sa raison tant que les mesures manquent", () => {
    rendre(<AvancementCommande numero="KS-2026-000042" transitions={["en_fabrication"]} mesuresManquantes retrait={false} />);
    const bouton = screen.getByRole("button", { name: "Passer en fabrication" });
    expect(bouton.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Confirme d'abord la réception des mesures.")).toBeTruthy();
  });
  it("retrait à Goma : aucun champ de numéro de suivi", () => {
    rendre(<AvancementCommande numero="KS-2026-000042" transitions={["expediee"]} mesuresManquantes={false} retrait />);
    expect(screen.queryByLabelText(/suivi/i)).toBeNull();
  });
  it("livraison : le champ de suivi est proposé à l'expédition", () => {
    rendre(<AvancementCommande numero="KS-2026-000042" transitions={["expediee"]} mesuresManquantes={false} retrait={false} />);
    expect(screen.getByLabelText(/suivi/i)).toBeTruthy();
  });
  it("transitionsPossibles : une Commande entièrement en stock n'a pas de fabrication, une pièce fabriquée n'a pas d'expédition directe", () => {
    const base = { statut: "payee" as const, offerte: false, lignesPhysiques: 1 };
    expect(transitionsPossibles({ ...base, lignesFabriquees: 0 })).toEqual(["expediee"]);
    expect(transitionsPossibles({ ...base, lignesFabriquees: 1 })).toEqual(["en_fabrication"]);
  });
});

describe("FormulaireRemboursement : la preuve est obligatoire (UX-DR44)", () => {
  it("refus de la base : un résumé d'erreur apparaît et rien n'est confirmé", async () => {
    faux.rembourser.mockResolvedValue({ ok: false, erreur: "preuve_requise" });
    rendre(<FormulaireRemboursement cibleType="commande" cibleId="TEST_id" />);
    await userEvent.click(screen.getByRole("button", { name: "J'ai rendu l'argent" }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("La demande n'a pas pu être enregistrée");
    expect(alerte.textContent).toContain("Saisis la référence du remboursement");
    expect(faux.refresh).not.toHaveBeenCalled();
  });
});

describe("FriseStatuts (story 6.1)", () => {
  const dates = { payee: "2026-11-01T10:00:00Z", en_fabrication: "2026-11-02T10:00:00Z", expediee: null, livree: null };
  it("l'étape courante porte aria-current, une seule, et aucune classe rouge", () => {
    const { container } = rendre(<FriseStatuts etapes={construireFrise({ statut: "en_fabrication", physique: true, fabrication: true, dates })} retraitGoma={false} locale="fr" />);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(container.innerHTML).not.toMatch(/danger|red|rouge|text-error/i);
  });
  it("retrait à Goma : « Prête à retirer » remplace « Expédiée »", () => {
    rendre(<FriseStatuts etapes={construireFrise({ statut: "expediee", physique: true, fabrication: false, dates })} retraitGoma locale="fr" />);
    expect(screen.getByText("Prête à retirer")).toBeTruthy();
  });
});
