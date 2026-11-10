import { beforeEach, describe, expect, it, vi } from "vitest";

// Story 9.7 : route POST /api/mesure. Le chemin vient du Referer ; sans Referer, rien n'est écrit.
vi.mock("server-only", () => ({}));
vi.mock("next/server", async () => {
  const reel = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...reel, connection: async () => {} };
});

const mocks = vi.hoisted(() => ({ deps: vi.fn() }));
vi.mock("@/modules/mesure/dependances", () => ({ dependancesMesure: () => mocks.deps() }));

import * as route from "@/app/api/mesure/route";
import type { DependancesMesure, EntreeMesure } from "@/modules/mesure/types";

const SESSION = "00000000-0000-4000-8000-000000000001";
let ecrits: EntreeMesure[] = [];

function installer(remplacements: Partial<DependancesMesure> = {}) {
  ecrits = [];
  const deps: DependancesMesure = {
    referer: async () => "https://boutique.test/fr/cosplays/nezuko?c=secret",
    hote: async () => "boutique.test",
    empreinteClient: async () => "TEST_empreinte",
    consommerEssai: async () => true,
    enregistrer: async (entree) => {
      ecrits.push(entree);
      return { erreur: null };
    },
    ...remplacements,
  };
  mocks.deps.mockReturnValue(deps);
}

const corps = (remplacements: Record<string, unknown> = {}) => ({
  action: "vue_fiche",
  langue: "fr",
  appareil: "ordinateur",
  session: SESSION,
  origine: null,
  provenance: null,
  ...remplacements,
});

function requete(valeur: unknown, type = "application/json") {
  return new Request("https://boutique.test/api/mesure", {
    method: "POST",
    headers: { "content-type": type },
    body: typeof valeur === "string" ? valeur : JSON.stringify(valeur),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  installer();
});

describe("POST /api/mesure", () => {
  it("écrit un événement valide : 204, chemin sans requête, aucune donnée personnelle", async () => {
    const r = await route.POST(requete(corps()));
    expect(r.status).toBe(204);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0].page).toBe("/cosplays/nezuko");
    expect(JSON.stringify(ecrits[0])).not.toContain("secret");
    expect(Object.keys(ecrits[0]).sort()).toEqual(["action", "appareil", "dureeMs", "langue", "origine", "page", "referent", "session"]);
  });

  it("Referer absent : 204 et rien d'écrit, jamais le chemin du client", async () => {
    installer({ referer: async () => null });
    const r = await route.POST(requete(corps()));
    expect(r.status).toBe(204);
    expect(ecrits).toHaveLength(0);
  });

  it("Referer d'une autre origine : 204 et rien d'écrit", async () => {
    installer({ referer: async () => "https://exemple.test/fr/cosplays" });
    expect((await route.POST(requete(corps()))).status).toBe(204);
    expect(ecrits).toHaveLength(0);
  });

  it("page exclue : 204 et rien d'écrit", async () => {
    installer({ referer: async () => "https://boutique.test/fr/admin/commandes" });
    expect((await route.POST(requete(corps()))).status).toBe(204);
    expect(ecrits).toHaveLength(0);
  });

  it("action privée depuis /compte : 204, page « /compte »", async () => {
    installer({ referer: async () => "https://boutique.test/fr/compte/photos" });
    expect((await route.POST(requete(corps({ action: "photo_envoyee" })))).status).toBe(204);
    expect(ecrits[0].page).toBe("/compte");
  });

  it("champ inconnu, JSON illisible ou action inconnue : 400, rien d'écrit", async () => {
    expect((await route.POST(requete(corps({ email: "a@b.test" })))).status).toBe(400);
    expect((await route.POST(requete("{pas du json"))).status).toBe(400);
    expect((await route.POST(requete(corps({ action: "achat" })))).status).toBe(400);
    expect(ecrits).toHaveLength(0);
  });

  it("corps trop gros : 413, rien d'écrit", async () => {
    const r = await route.POST(requete(corps({ origine: "a".repeat(2000) })));
    expect(r.status).toBe(413);
    expect(ecrits).toHaveLength(0);
  });

  it("type de contenu non JSON : 415, rien d'écrit", async () => {
    expect((await route.POST(requete(corps(), "text/plain"))).status).toBe(415);
    expect(ecrits).toHaveLength(0);
  });

  it("limite de débit atteinte : 204 sans écriture", async () => {
    installer({ consommerEssai: async () => false });
    expect((await route.POST(requete(corps()))).status).toBe(204);
    expect(ecrits).toHaveLength(0);
  });

  it("écriture en échec : 500, jamais un faux succès", async () => {
    installer({ enregistrer: async () => ({ erreur: "KS_MESURE_INVALIDE" }) });
    expect((await route.POST(requete(corps()))).status).toBe(500);
    expect(ecrits).toHaveLength(0);
  });

  it("aucune méthode GET : la mesure ne se déclenche pas par une ouverture d'adresse", () => {
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });
});
