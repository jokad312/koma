// Story 9.16 c) : lireTableauDeBord. Le client service est simulé (aucune base) : on vérifie les appels de fonctions d'agrégats et la
// répartition des valeurs dans les champs. Données de test nommées TEST_ : jamais utilisées hors des tests.
import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => {
  // Requêtes .from(...) : chaîne de méthodes qui se résout sur une liste vide.
  const chaine = (): unknown =>
    new Proxy(
      {},
      {
        get: (_c, nom) => {
          if (nom === "then") return (ok: (v: unknown) => unknown) => ok({ data: [], error: null });
          if (nom === "maybeSingle") return async () => ({ data: { clients_payants: 0, clients_deux_achats: 0 }, error: null });
          return () => chaine();
        },
      },
    );
  return { creerClientService: () => ({ rpc: faux.rpc, from: () => chaine() }) };
});
vi.mock("@/modules/admin/queries", () => ({ lireTachesAdmin: async () => [], compterMessagesNouveaux: async () => 0 }));
vi.mock("@/modules/commande/admin-queries", () => ({ lireMesuresARecevoir: async () => ({ total: 0 }), lireTachesRemboursement: async () => [] }));

import { minuitGoma } from "@/modules/tableau-de-bord/periode";
import { lireTableauDeBord } from "@/modules/tableau-de-bord/queries";

const TEST_AUTEUR = { type: "compte", id: "00000000-0000-0000-0000-0000000000aa", role: "admin" } as never;
const TEST_MAINTENANT = new Date("2026-11-17T10:00:00Z");
const TEST_AUJOURDHUI = minuitGoma(0, TEST_MAINTENANT).toISOString();
const TEST_CHIFFRES = { produits_publies: 11, commandes_payees: 22, revenu_cents: 33333, tentatives_reussies: 44, tentatives_terminees: 55, evenements_a_venir: 66, pass_7: 77, pass_30: 88 };

beforeEach(() => {
  faux.rpc.mockReset();
  faux.rpc.mockImplementation(async (nom: string, args: { p_depuis?: string }) => {
    if (nom === "tableau_commandes_payees") {
      const numero = args.p_depuis === TEST_AUJOURDHUI ? "KS-TEST-JOUR" : "KS-TEST-SEPT";
      return { data: [{ numero, total_cents: 1000, prestataire: "pawapay", familles: ["kit"] }], error: null };
    }
    if (nom === "tableau_chiffres") return { data: [TEST_CHIFFRES], error: null };
    if (nom === "tableau_delai_mesures") return { data: [{ lignes_recues: 0, lignes_en_attente: 0, delai_moyen_heures: null }], error: null };
    if (nom === "compter_photos_a_traiter") return { data: { a_valider: 0, realisations: 0, retraits: 0 }, error: null };
    return { data: [], error: null };
  });
});

describe("lireTableauDeBord (9.16 c)", () => {
  it("?periode=7 : deux lectures des commandes payées, dont une depuis minuit à Goma ; Performance du jour vient de celle-ci", async () => {
    const d = await lireTableauDeBord({ auteur: TEST_AUTEUR, maintenant: TEST_MAINTENANT, commandesSurSeptJours: true });
    const appels = faux.rpc.mock.calls.filter(([nom]) => nom === "tableau_commandes_payees").map(([, a]) => (a as { p_depuis: string }).p_depuis);
    expect(appels).toHaveLength(2);
    expect(appels).toContain(TEST_AUJOURDHUI);
    expect(appels).toContain(minuitGoma(6, TEST_MAINTENANT).toISOString());
    expect(d.ventesJour?.map((c) => c.numero)).toEqual(["KS-TEST-JOUR"]);
    expect(d.commandesPayees?.map((c) => c.numero)).toEqual(["KS-TEST-SEPT"]);
  });

  it("sans période : une seule lecture des commandes (celle d'aujourd'hui), reprise pour Performance du jour", async () => {
    const d = await lireTableauDeBord({ auteur: TEST_AUTEUR, maintenant: TEST_MAINTENANT, commandesSurSeptJours: false });
    const appels = faux.rpc.mock.calls.filter(([nom]) => nom === "tableau_commandes_payees");
    expect(appels).toHaveLength(1);
    expect(d.ventesJour?.map((c) => c.numero)).toEqual(["KS-TEST-JOUR"]);
  });

  it("tableau_chiffres : chaque valeur dans son champ", async () => {
    const d = await lireTableauDeBord({ auteur: TEST_AUTEUR, maintenant: TEST_MAINTENANT, commandesSurSeptJours: false });
    expect(d.chiffres).toEqual({
      produitsPublies: 11,
      commandesPayees: 22,
      revenuCents: 33333,
      tentativesReussies: 44,
      tentativesTerminees: 55,
      evenementsAVenir: 66,
      pass7: 77,
      pass30: 88,
    });
  });

  it("tableau_chiffres en échec : zone illisible (null), jamais des zéros", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    const parDefaut = faux.rpc.getMockImplementation()!;
    faux.rpc.mockImplementation(async (nom: string, args: never) => (nom === "tableau_chiffres" ? { data: null, error: { message: "TEST_ panne" } } : parDefaut(nom, args)));
    const d = await lireTableauDeBord({ auteur: TEST_AUTEUR, maintenant: TEST_MAINTENANT, commandesSurSeptJours: false });
    expect(d.chiffres).toBeNull();
    expect(d.ventesJour).not.toBeNull();
    erreur.mockRestore();
  });
});
