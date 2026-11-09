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
        { id: "TEST_a", statut: "en_attente", nomAffiche: "TEST_Pseudo", ville: null, retraitDemande: false, creeLe: "2026-11-08T10:00:00Z", kitFr: null, kitEn: null },
        { id: "TEST_b", statut: "publiee", nomAffiche: null, ville: "TEST_Goma", retraitDemande: true, creeLe: "2026-11-07T10:00:00Z", kitFr: null, kitEn: null },
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

describe("story 8.4 : Réalisations (lecture et aiguillage)", () => {
  const AUTEUR = { type: "compte" as const, id: "TEST", role: null };

  it("deposer : avec un Kit, deposer_realisation reçoit p_kit ; sans Kit, deposer_photo_galerie sans p_kit", async () => {
    faux.rpc.mockResolvedValue({ data: "TEST_id", error: null });
    await dependancesCommunaute().deposer({ auteur: AUTEUR, objet: "photos-clients/a.jpg", nom: null, ville: null, kitId: "TEST_kit" });
    expect(faux.rpc).toHaveBeenLastCalledWith("deposer_realisation", expect.objectContaining({ p_kit: "TEST_kit", p_objet: "photos-clients/a.jpg" }));
    await dependancesCommunaute().deposer({ auteur: AUTEUR, objet: "photos-clients/b.jpg", nom: null, ville: null });
    expect(faux.rpc).toHaveBeenLastCalledWith("deposer_photo_galerie", expect.not.objectContaining({ p_kit: expect.anything() }));
  });

  it("kitsPayes : titres lus, titre anglais absent = null, ligne mal formée écartée", async () => {
    faux.rpc.mockResolvedValue({ data: [{ id: "TEST_k1", titre_fr: "TEST_Kit", titre_en: null }, { id: 3 }], error: null });
    expect(await dependancesCommunaute().kitsPayes("TEST_compte")).toEqual({ kits: [{ id: "TEST_k1", titreFr: "TEST_Kit", titreEn: null }] });
  });

  it("lister : le titre du Kit d'une Réalisation est lu", async () => {
    faux.rpc.mockResolvedValue({ data: [{ id: "TEST_r", objet: "photos-clients/r.jpg", statut: "en_attente", cree_le: "2026-11-09T10:00:00Z", kit_fr: "TEST_Kit", kit_en: "TEST_Kit EN" }], error: null });
    const r = await dependancesCommunaute().lister("TEST_compte");
    expect("photos" in r && r.photos[0]).toMatchObject({ kitFr: "TEST_Kit", kitEn: "TEST_Kit EN" });
  });
});
