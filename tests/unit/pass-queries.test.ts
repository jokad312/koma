// Story 7.5, revue : « Mes Pass » ne montre plus de QR pour un Pass dont la Commande est annulée ou remboursée. Faux client Supabase nommé TEST.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ lignes: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    from: () => {
      const chaine = { select: () => chaine, eq: () => chaine, order: () => chaine, then: (ok: (v: unknown) => void) => ok({ data: etat.lignes, error: null }) };
      return chaine;
    },
  }),
}));

import { listerMesPass } from "@/modules/evenements/pass-queries";

const ligne = (id: string, statutCommande: string, statut = "valide") => ({
  id,
  nom_titulaire: `TEST_${id}`,
  statut,
  jeton: "0".repeat(48),
  code_court: "ABCD2345",
  evenement: { id: "e", slug: "e", titre_fr: "TEST_E", titre_en: null, lieu_fr: null, lieu_en: null, debut_le: null, fin_le: null },
  ligne: { pass_nom_fr: "TEST_Type", pass_nom_en: null },
  commande: { compte_id: "TEST_compte", offerte: false, statut: statutCommande },
});

describe("listerMesPass", () => {
  beforeEach(() => {
    etat.lignes = [ligne("a", "payee"), ligne("b", "annulee"), ligne("c", "remboursee"), ligne("d", "offerte")];
  });
  it("marque annulé ou remboursé un Pass dont la Commande n'est plus payée ni offerte", async () => {
    const r = await listerMesPass("TEST_compte", "fr");
    expect(r.map((p) => p.statut)).toEqual(["valide", "annule", "rembourse", "valide"]);
  });
  it("ignore les lignes d'un autre Compte", async () => {
    etat.lignes = [{ ...ligne("x", "payee"), commande: { compte_id: "AUTRE", offerte: false, statut: "payee" } }];
    expect(await listerMesPass("TEST_compte", "fr")).toEqual([]);
  });
});
