// Story 8.1 : lecture des réponses réelles de lister_mes_photos et retirer_photo (format JSON de la base).
import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/compte", () => ({ exigerCompteComplet: vi.fn(), CompteRefuseError: class extends Error {} }));
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({ rpc: faux.rpc, storage: { from: () => ({}) } }) }));

import { dependancesCommunaute } from "@/modules/communaute/dependances";

beforeEach(() => vi.clearAllMocks());

describe("dependancesCommunaute", () => {
  it("lister : clés de la base traduites, objet gardé côté serveur, ligne inconnue écartée", async () => {
    faux.rpc.mockResolvedValue({
      data: [
        { id: "TEST_a", objet: "photos-clients/a.jpg", statut: "en_attente", nom_affiche: "TEST_Pseudo", ville: null, retrait_demande_le: null, cree_le: "2026-11-08T10:00:00Z" },
        { id: "TEST_b", objet: "photos-clients/b.jpg", statut: "publiee", nom_affiche: null, ville: "TEST_Goma", retrait_demande_le: "2026-11-08T11:00:00Z", cree_le: "2026-11-07T10:00:00Z" },
        { id: "TEST_c", objet: "photos-clients/c.jpg", statut: "inconnu", cree_le: "2026-11-06T10:00:00Z" },
      ],
      error: null,
    });
    const r = await dependancesCommunaute().lister("TEST_compte");
    expect(faux.rpc).toHaveBeenCalledWith("lister_mes_photos", { p_compte: "TEST_compte" });
    expect(r).toEqual({
      photos: [
        { id: "TEST_a", statut: "en_attente", nomAffiche: "TEST_Pseudo", ville: null, retraitDemande: false, creeLe: "2026-11-08T10:00:00Z" },
        { id: "TEST_b", statut: "publiee", nomAffiche: null, ville: "TEST_Goma", retraitDemande: true, creeLe: "2026-11-07T10:00:00Z" },
      ],
      objets: { TEST_a: "photos-clients/a.jpg", TEST_b: "photos-clients/b.jpg" },
    });
  });

  it("retirer : résultat et objet lus ; réponse inattendue = erreur", async () => {
    faux.rpc.mockResolvedValueOnce({ data: { resultat: "demande", objet: "photos-clients/b.jpg" }, error: null });
    expect(await dependancesCommunaute().retirer({ type: "compte", id: "TEST", role: null }, "TEST_b")).toEqual({ resultat: "demande", objet: "photos-clients/b.jpg" });
    faux.rpc.mockResolvedValueOnce({ data: { resultat: "autre" }, error: null });
    expect(await dependancesCommunaute().retirer({ type: "compte", id: "TEST", role: null }, "TEST_b")).toEqual({ erreur: "retirer_photo" });
  });
});
