// Story 9.12 : après la connexion, un retour qui n'est que l'accueil de la langue devient l'arrivée par défaut ; un retour précis et les
// étapes intermédiaires (âge, questions) sont inchangés. Service et arrivée remplacés par des doubles de test (règle 13).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({}), headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const faux = vi.hoisted(() => ({ resultat: null as unknown, appels: [] as unknown[][] }));
vi.mock("@/modules/comptes/dependances", () => ({ dependances: async () => ({}) }));
vi.mock("@/modules/comptes/service", () => ({
  verifierCode: async () => faux.resultat,
  declarerAge: async () => faux.resultat,
  enregistrerQuestionsAccueil: async () => faux.resultat,
}));
vi.mock("@/lib/auth/arrivee-serveur", () => ({
  destinationApresConnexion: async (retour: string, locale: string) => {
    faux.appels.push([retour, locale]);
    return retour === `/${locale}` ? `/${locale}/TEST_arrivee` : retour;
  },
}));

import { declarerAge, enregistrerQuestionsAccueil, verifierCode } from "@/modules/comptes/actions";

const entree = { langue: "fr" } as never;

beforeEach(() => {
  faux.appels = [];
});

describe("arrivée après la connexion (actions)", () => {
  it("étape « termine » sans retour précis : retour réécrit, langue tirée du retour validé", async () => {
    faux.resultat = { ok: true, etape: "termine", retour: "/en" };
    expect(await verifierCode(entree)).toEqual({ ok: true, etape: "termine", retour: "/en/TEST_arrivee" });
    expect(faux.appels).toEqual([["/en", "en"]]);
  });

  it("questions d'accueil enregistrées sans retour précis : retour réécrit", async () => {
    faux.resultat = { ok: true, retour: "/fr" };
    expect(await enregistrerQuestionsAccueil(entree)).toEqual({ ok: true, retour: "/fr/TEST_arrivee" });
  });

  it("étape « age » : inchangé, aucune lecture de rôle", async () => {
    faux.resultat = { ok: true, etape: "age", retour: "/fr" };
    expect(await declarerAge(entree)).toEqual({ ok: true, etape: "age", retour: "/fr" });
    expect(faux.appels).toEqual([]);
  });

  it("retour précis : inchangé", async () => {
    faux.resultat = { ok: true, etape: "termine", retour: "/fr/panier" };
    expect(await verifierCode(entree)).toEqual({ ok: true, etape: "termine", retour: "/fr/panier" });
  });

  it("échec : inchangé", async () => {
    faux.resultat = { ok: false, erreur: "code_faux" };
    expect(await verifierCode(entree)).toEqual({ ok: false, erreur: "code_faux" });
  });
});
