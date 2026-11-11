// Story 7.7 : branchement des accès bénévoles sur la base. Client Supabase FAUX (données TEST_) : le droit exigé est « benevoles.acces » (Admin seul),
// l'auteur vient de la session, la liste n'est jamais inventée.
import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ rpc: vi.fn(), exigerDroit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/droits", () => ({ exigerDroit: (...a: unknown[]) => faux.exigerDroit(...a) }));
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({ rpc: (...a: unknown[]) => faux.rpc(...a) }) }));

import { dependancesBenevoles, lireAccesBenevoles } from "@/modules/benevoles/dependances";

const EVENEMENT = "00000000-0000-4000-8000-0000000000e1";
const AUTEUR = { type: "compte" as const, id: "TEST_admin", role: "admin" as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dépendances des accès bénévoles", () => {
  it("exige le droit benevoles.acces (Admin seul)", async () => {
    faux.exigerDroit.mockResolvedValue({ compteId: "TEST_admin", auteur: AUTEUR });
    expect(await dependancesBenevoles().exigerDroit()).toEqual({ auteur: AUTEUR });
    expect(faux.exigerDroit).toHaveBeenCalledWith("benevoles.acces");
  });
  it("attribuer : appelle la fonction de la base avec l'auteur, l'Événement et l'email, rend l'état", async () => {
    faux.rpc.mockResolvedValue({ data: { statut: "sans_compte" }, error: null });
    expect(await dependancesBenevoles().attribuer({ auteur: AUTEUR, evenementId: EVENEMENT, email: "test@example.invalid" })).toEqual({ erreur: null, statut: "sans_compte" });
    expect(faux.rpc).toHaveBeenCalledWith("attribuer_acces_benevole", { p_auteur: AUTEUR, p_evenement: EVENEMENT, p_email: "test@example.invalid" });
  });
  it("attribuer : une erreur de la base ne rend que son code KS_, sans l'email", async () => {
    faux.rpc.mockResolvedValue({ data: null, error: { message: "KS_DROIT_REFUSE test@example.invalid", code: "P0001" } });
    expect(await dependancesBenevoles().attribuer({ auteur: AUTEUR, evenementId: EVENEMENT, email: "test@example.invalid" })).toEqual({ erreur: "KS_DROIT_REFUSE", statut: null });
  });
  it("retirer : passe l'Événement ET l'accès, rend si quelque chose a été retiré", async () => {
    faux.rpc.mockResolvedValue({ data: false, error: null });
    expect(await dependancesBenevoles().retirer({ auteur: AUTEUR, evenementId: EVENEMENT, accesId: "TEST_acces" })).toEqual({ erreur: null, retire: false });
    expect(faux.rpc).toHaveBeenCalledWith("retirer_acces_benevole", { p_auteur: AUTEUR, p_evenement: EVENEMENT, p_acces: "TEST_acces" });
  });
  it("lireAccesBenevoles : transforme les lignes de la base, demande les accès de CET Événement", async () => {
    faux.rpc.mockResolvedValue({ data: [{ id: "a", email: "x@example.invalid", valable_du: "d", valable_jusqu_au: "f", valide: true }], error: null });
    expect(await lireAccesBenevoles(AUTEUR, EVENEMENT)).toEqual([{ id: "a", email: "x@example.invalid", valableDu: "d", valableJusquAu: "f", etat: "valide" }]);
    expect(faux.rpc).toHaveBeenCalledWith("lister_acces_benevoles", { p_auteur: AUTEUR, p_evenement: EVENEMENT });
  });
  it("lireAccesBenevoles : erreur relancée, jamais une liste vide", async () => {
    faux.rpc.mockResolvedValue({ data: null, error: { message: "KS_DROIT_REFUSE" } });
    await expect(lireAccesBenevoles(AUTEUR, EVENEMENT)).rejects.toThrow();
  });
});
