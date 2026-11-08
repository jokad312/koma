// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const faux = vi.hoisted(() => ({
  creerCommande: vi.fn(),
  lireRecapitulatif: vi.fn(),
  push: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/fr/commande" }));
vi.mock("@/modules/commande/actions", () => ({
  creerCommande: (...a: unknown[]) => faux.creerCommande(...a),
  lireRecapitulatif: (...a: unknown[]) => faux.lireRecapitulatif(...a),
  obtenirKitGratuit: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: faux.push }),
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));

import { FormulaireCommande } from "@/components/commande/FormulaireCommande";
import frMessages from "../../messages/fr.json";
import enMessages from "../../messages/en.json";
import { formaterUsd as formaterBrut } from "@/lib/argent";
import type { Recapitulatif } from "@/modules/commande/types";

// Intl met des espaces insécables autour du symbole : on les ramène à des espaces simples, comme le fait le DOM testé.
const formaterUsd = (c: number, l: "fr" | "en") => formaterBrut(c, l).replace(/[  ]/g, " ");
const TC = frMessages.Commande.code;

const recap = (s: Partial<Recapitulatif> = {}): Recapitulatif => ({
  lignes: [
    {
      ligneId: "00000000-0000-4000-8000-0000000000c1",
      produitId: "00000000-0000-4000-8000-0000000000aa",
      famille: "cosplay",
      slug: "test-cosplay",
      titre: "TEST_Cosplay",
      taille: "M",
      nombre: 2,
      prixCents: 5000,
      etat: "disponible",
      origine: "stock",
      delaiFabricationJours: null,
      reductionCents: 0,
    },
  ],
  physique: true,
  kit: false,
  surMesure: false,
  sousTotalCents: 10000,
  forfaitCents: 0,
  reductionCents: 0,
  code: null,
  totalCents: 10000,
  indisponible: false,
  remiseManquante: false,
  empreinte: "0123456789abcdef0123456789abcdef",
  ...s,
});

const props = {
  recapInitial: recap(),
  zoneInitiale: "goma" as const,
  modeInitial: "retrait" as const,
  telephoneInitial: "+243990000000",
  adresseInitiale: "",
  lieuRetrait: "TEST_Lieu",
  origine: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Code promo à l'étape de commande (story 9.2)", () => {
  it("les messages de refus sont ceux de la story, en français et en anglais, avec la même liste de clés", () => {
    expect(TC.erreurs.code_inconnu).toBe("Ce code n'existe pas. Vérifie l'orthographe.");
    expect(TC.erreurs.code_inactif).toBe("Ce code n'est plus actif.");
    expect(TC.erreurs.code_plafond).toBe("Ce code a été utilisé le nombre maximal de fois.");
    expect(TC.erreurs.code_premier_achat).toBe("Ce code est réservé à un premier achat.");
    expect(TC.erreurs.code_un_seul).toBe("Un seul code par achat.");
    expect(Object.keys(enMessages.Commande.code.erreurs).sort()).toEqual(Object.keys(TC.erreurs).sort());
    expect(Object.keys(enMessages.Commande.code).sort()).toEqual(Object.keys(TC).sort());
  });

  it("un code accepté : la réduction s'affiche en USD, le total vient du serveur, le code est envoyé à la création", async () => {
    faux.lireRecapitulatif.mockResolvedValue({
      ok: true,
      recap: recap({ reductionCents: 1000, totalCents: 9000, code: { valide: true, code: "PROMO10", reductionPct: 10 } }),
    });
    faux.creerCommande.mockResolvedValue({ ok: true, numero: "KS-2026-000042", expireLe: "2026-11-01T12:30:00Z" });
    rendre(<FormulaireCommande {...props} />);
    await userEvent.type(screen.getByLabelText(TC.label), " promo10 ");
    await userEvent.click(screen.getByRole("button", { name: TC.appliquer }));
    await waitFor(() => expect(faux.lireRecapitulatif).toHaveBeenLastCalledWith({ zone: "goma", mode: "retrait", code: "promo10" }, "fr"));
    await screen.findByText("Réduction (PROMO10)");
    const ligneReduction = (screen.getByText("Réduction (PROMO10)").parentElement?.textContent ?? "").replace(/[  ]/g, " ");
    expect(ligneReduction.endsWith(formaterUsd(1000, "fr"))).toBe(true);
    expect(ligneReduction).toContain(frMessages.Commande.recap.reductionMontant.replace("{montant}", ""));
    expect(screen.getByText("Réduction (PROMO10)")).toBeTruthy();
    expect(screen.getByText(formaterUsd(9000, "fr"))).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("PROMO10");
    await userEvent.click(screen.getAllByRole("checkbox")[0]);
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await waitFor(() => expect(faux.creerCommande).toHaveBeenCalledTimes(1));
    expect(faux.creerCommande).toHaveBeenCalledWith(expect.objectContaining({ code: "promo10", totalAttenduCents: 9000 }), "fr");
  });

  it("un code refusé : la raison s'affiche sous le champ (annoncée), le total revient sans réduction, le code n'est pas envoyé", async () => {
    faux.lireRecapitulatif.mockResolvedValue({ ok: true, recap: recap({ code: { valide: false, erreur: "code_inconnu" } }) });
    faux.creerCommande.mockResolvedValue({ ok: true, numero: "KS-2026-000043", expireLe: "2026-11-01T12:30:00Z" });
    rendre(<FormulaireCommande {...props} />);
    await userEvent.type(screen.getByLabelText(TC.label), "NOPE");
    await userEvent.click(screen.getByRole("button", { name: TC.appliquer }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toBe(TC.erreurs.code_inconnu);
    expect((screen.getByLabelText(TC.label) as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText(TC.label).getAttribute("aria-describedby")).toContain(alerte.id);
    await userEvent.click(screen.getAllByRole("checkbox")[0]);
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await waitFor(() => expect(faux.creerCommande).toHaveBeenCalledTimes(1));
    expect(faux.creerCommande).toHaveBeenCalledWith(expect.objectContaining({ code: null, totalAttenduCents: 10000 }), "fr");
  });

  it("un code refusé à la création : la raison s'affiche sous le champ, rien n'est présenté comme réussi", async () => {
    faux.creerCommande.mockResolvedValue({ ok: false, erreur: "code_plafond" });
    faux.lireRecapitulatif.mockResolvedValue({ ok: true, recap: recap() });
    rendre(<FormulaireCommande {...props} recapInitial={recap({ reductionCents: 1000, totalCents: 9000, code: { valide: true, code: "PROMO10", reductionPct: 10 } })} />);
    await userEvent.type(screen.getByLabelText(TC.label), "PROMO10");
    await userEvent.click(screen.getByRole("button", { name: TC.appliquer }));
    await waitFor(() => expect(faux.lireRecapitulatif).toHaveBeenCalled());
    await userEvent.click(screen.getAllByRole("checkbox")[0]);
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    const alerte = await screen.findByText(TC.erreurs.code_plafond);
    expect(within(alerte.parentElement as HTMLElement).getByLabelText(TC.label)).toBeTruthy();
    expect(faux.push).not.toHaveBeenCalled();
    // Le code refusé n'est plus envoyé : le total est relu sans code, et le nouvel envoi part sans code avec une nouvelle clé d'idempotence.
    await waitFor(() => expect(faux.lireRecapitulatif).toHaveBeenLastCalledWith({ zone: "goma", mode: "retrait", code: null }, "fr"));
    faux.creerCommande.mockResolvedValueOnce({ ok: true, numero: "KS-2026-000044", expireLe: "2026-11-01T12:30:00Z" });
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    await waitFor(() => expect(faux.creerCommande).toHaveBeenCalledTimes(2));
    const [premier, second] = faux.creerCommande.mock.calls.map((c) => c[0] as { code: string | null; cleIdempotence: string });
    expect(premier.code).toBe("PROMO10");
    expect(second.code).toBeNull();
    expect(second.cleIdempotence).not.toBe(premier.cleIdempotence);
  });

  it("changer de Zone après avoir appliqué un code : le code reste envoyé et la réduction reste affichée", async () => {
    const avecCode = recap({ reductionCents: 1000, totalCents: 9000, code: { valide: true, code: "PROMO10", reductionPct: 10 } });
    faux.lireRecapitulatif.mockResolvedValue({ ok: true, recap: avecCode });
    rendre(<FormulaireCommande {...props} />);
    await userEvent.type(screen.getByLabelText(TC.label), "PROMO10");
    await userEvent.click(screen.getByRole("button", { name: TC.appliquer }));
    await screen.findByText("Réduction (PROMO10)");
    await userEvent.click(screen.getByRole("radio", { name: "Bukavu" }));
    await waitFor(() => expect(faux.lireRecapitulatif).toHaveBeenLastCalledWith({ zone: "bukavu", mode: "livraison", code: "PROMO10" }, "fr"));
    expect(screen.getByText("Réduction (PROMO10)")).toBeTruthy();
  });

  it("le pourcentage est mis en forme selon la langue (12,5 % en français)", async () => {
    faux.lireRecapitulatif.mockResolvedValue({
      ok: true,
      recap: recap({ reductionCents: 1250, totalCents: 8750, code: { valide: true, code: "DEMI", reductionPct: 12.5 } }),
    });
    rendre(<FormulaireCommande {...props} />);
    await userEvent.type(screen.getByLabelText(TC.label), "DEMI");
    await userEvent.click(screen.getByRole("button", { name: TC.appliquer }));
    expect((await screen.findByRole("status")).textContent).toContain("12,5");
  });

  it("« Retirer le code » : le total est relu sans code", async () => {
    faux.lireRecapitulatif
      .mockResolvedValueOnce({ ok: true, recap: recap({ reductionCents: 1000, totalCents: 9000, code: { valide: true, code: "PROMO10", reductionPct: 10 } }) })
      .mockResolvedValueOnce({ ok: true, recap: recap() });
    rendre(<FormulaireCommande {...props} />);
    await userEvent.type(screen.getByLabelText(TC.label), "PROMO10");
    await userEvent.click(screen.getByRole("button", { name: TC.appliquer }));
    await userEvent.click(await screen.findByRole("button", { name: TC.retirer }));
    await waitFor(() => expect(faux.lireRecapitulatif).toHaveBeenLastCalledWith({ zone: "goma", mode: "retrait", code: null }, "fr"));
    await waitFor(() => expect(screen.queryByText("Réduction (PROMO10)")).toBeNull());
    expect((screen.getByLabelText(TC.label) as HTMLInputElement).value).toBe("");
  });
});
