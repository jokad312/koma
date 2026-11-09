// Story 8.4 : lecture de la file du personnel (réponse réelle de lister_photos_admin) : Réalisation avec Kit et preuve d'achat.
import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("@/lib/auth/droits", () => ({ exigerDroit: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({ rpc: faux.rpc, storage: { from: () => ({}) } }) }));

import { dependancesGalerie } from "@/modules/communaute/admin-dependances";

const AUTEUR = { type: "compte" as const, id: "TEST", role: "admin" as const };
const ligne = (s: Record<string, unknown> = {}) => ({
  id: "TEST_a",
  objet: "photos-clients/a.jpg",
  fichier_public: null,
  statut: "en_attente",
  source: "compte",
  nom_affiche: null,
  ville: null,
  retrait_demande_le: null,
  cree_le: "2026-11-09T10:00:00Z",
  accord_whatsapp_le: null,
  capture: false,
  realisation: null,
  ...s,
});

beforeEach(() => vi.clearAllMocks());

describe("dependancesGalerie().lister", () => {
  it("Réalisation : Kit, preuve d'achat et rang lus ; photo simple : null", async () => {
    faux.rpc.mockResolvedValue({
      data: [
        ligne({ id: "TEST_r", realisation: { kit_fr: "TEST_Kit", kit_en: null, commande: "KS-2026-870001", paye_le: "2026-11-07T10:00:00Z", rang: 2 } }),
        ligne({ id: "TEST_p" }),
      ],
      error: null,
    });
    const r = await dependancesGalerie().lister(AUTEUR);
    expect(faux.rpc).toHaveBeenCalledWith("lister_photos_admin", { p_auteur: AUTEUR });
    expect("photos" in r && r.photos.map((p) => p.realisation)).toEqual([
      { kitFr: "TEST_Kit", kitEn: null, commande: "KS-2026-870001", payeLe: "2026-11-07T10:00:00Z", rang: 2 },
      null,
    ]);
  });

  it("Réalisation encore à valider : rang absent = null", async () => {
    faux.rpc.mockResolvedValue({ data: [ligne({ realisation: { kit_fr: "TEST_Kit", kit_en: "TEST_Kit EN", commande: "KS-2026-870001", paye_le: "2026-11-07T10:00:00Z", rang: null } })], error: null });
    const r = await dependancesGalerie().lister(AUTEUR);
    expect("photos" in r && r.photos[0].realisation).toMatchObject({ kitEn: "TEST_Kit EN", rang: null });
  });
});
