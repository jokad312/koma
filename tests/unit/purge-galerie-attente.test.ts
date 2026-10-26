import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AGE_MAX_ATTENTE_MS, purgerGalerieAttente, type EntreeAttente, type StockageAttente } from "@/modules/catalogue/purge";

vi.mock("server-only", () => ({}));

const route = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("next/server", async () => {
  const reel = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...reel, connection: async () => {} };
});
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({ storage: { from: () => ({ list: route.list, remove: route.remove }) } }),
}));

import { POST } from "@/app/api/cron/purger-galerie-attente/route";

const MAINTENANT = Date.parse("2026-10-27T12:00:00Z");
const il_y_a = (heures: number) => new Date(MAINTENANT - heures * 3_600_000).toISOString();

// Stockage simulé (tests seulement) : dossiers de galerie-attente et objets effacés.
function TEST_stockage(contenu: Record<string, EntreeAttente[]>, opts: { erreurSuppression?: boolean; erreurRacine?: boolean } = {}) {
  const effaces: string[] = [];
  const stockage: StockageAttente = {
    lister: async (dossier) => {
      if (dossier === "" && opts.erreurRacine) return { erreur: "TEST_panne", entrees: [] };
      if (dossier === "") {
        return { erreur: null, entrees: Object.keys(contenu).map((name) => ({ name, creeLe: null, estDossier: true })) };
      }
      return { erreur: null, entrees: contenu[dossier] ?? [] };
    },
    supprimer: async (objets) => {
      if (opts.erreurSuppression) return { erreur: "TEST_refus", effaces: 0 };
      effaces.push(...objets);
      return { erreur: null, effaces: objets.length };
    },
  };
  return { stockage, effaces };
}
const fichier = (name: string, creeLe: string | null): EntreeAttente => ({ name, creeLe, estDossier: false });

describe("purgerGalerieAttente", () => {
  it("la limite est de 24 h", () => expect(AGE_MAX_ATTENTE_MS).toBe(86_400_000));

  it("n'efface que les objets de plus de 24 h", async () => {
    const { stockage, effaces } = TEST_stockage({
      TEST_p1: [fichier("recent.jpg", il_y_a(2)), fichier("ancien.jpg", il_y_a(30)), fichier("limite.jpg", il_y_a(23.9))],
      TEST_p2: [fichier("ancien2.png", il_y_a(25))],
    });
    expect(await purgerGalerieAttente(stockage, MAINTENANT)).toEqual({ ok: true, effaces: 2, echecs: 0 });
    expect(effaces.sort()).toEqual(["TEST_p1/ancien.jpg", "TEST_p2/ancien2.png"]);
  });

  it("un objet sans date lisible n'est jamais effacé", async () => {
    const { stockage, effaces } = TEST_stockage({ TEST_p1: [fichier("a.jpg", null), fichier("b.jpg", "pas une date")] });
    expect(await purgerGalerieAttente(stockage, MAINTENANT)).toEqual({ ok: true, effaces: 0, echecs: 0 });
    expect(effaces).toEqual([]);
  });

  it("bucket vide : rien à faire", async () => {
    const { stockage } = TEST_stockage({});
    expect(await purgerGalerieAttente(stockage, MAINTENANT)).toEqual({ ok: true, effaces: 0, echecs: 0 });
  });

  it("par lots de 100", async () => {
    const nombreux = Array.from({ length: 230 }, (_, i) => fichier(`f${i}.jpg`, il_y_a(48)));
    const { stockage, effaces } = TEST_stockage({ TEST_p1: nombreux });
    const spy = vi.spyOn(stockage, "supprimer");
    expect(await purgerGalerieAttente(stockage, MAINTENANT)).toEqual({ ok: true, effaces: 230, echecs: 0 });
    expect(spy.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 30]);
    expect(effaces).toHaveLength(230);
  });

  it("échec d'effacement : compté, jamais compté comme effacé", async () => {
    const { stockage } = TEST_stockage({ TEST_p1: [fichier("ancien.jpg", il_y_a(30))] }, { erreurSuppression: true });
    expect(await purgerGalerieAttente(stockage, MAINTENANT)).toEqual({ ok: true, effaces: 0, echecs: 1 });
  });

  it("le compte vient de ce que le stockage dit avoir effacé, pas de la taille du lot", async () => {
    const { stockage } = TEST_stockage({ TEST_p1: [fichier("a.jpg", il_y_a(30)), fichier("b.jpg", il_y_a(30))] });
    vi.spyOn(stockage, "supprimer").mockResolvedValueOnce({ erreur: null, effaces: 1 });
    expect(await purgerGalerieAttente(stockage, MAINTENANT)).toEqual({ ok: true, effaces: 1, echecs: 1 });
  });

  it("lecture impossible de la racine : échec", async () => {
    const { stockage } = TEST_stockage({}, { erreurRacine: true });
    expect(await purgerGalerieAttente(stockage, MAINTENANT)).toEqual({ ok: false });
  });
});

const SECRET = "TEST_secret-de-purge";
const requete = (entetes: Record<string, string> = {}, methode = "POST") =>
  new Request("http://localhost/api/cron/purger-galerie-attente", { method: methode, headers: entetes });

describe("route /api/cron/purger-galerie-attente", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    route.list.mockReset();
    route.remove.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MAINTENANT);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([
    ["sans en-tête", {}],
    ["secret faux", { authorization: "Bearer TEST_mauvais" }],
    ["sans le mot Bearer", { authorization: SECRET }],
    ["secret vide", { authorization: "Bearer " }],
  ])("%s : 401 et rien n'est lu ni effacé", async (_nom, entetes) => {
    const reponse = await POST(requete(entetes));
    expect(reponse.status).toBe(401);
    expect(route.list).not.toHaveBeenCalled();
    expect(route.remove).not.toHaveBeenCalled();
  });

  it("CRON_SECRET absente de l'environnement : 401 même avec un en-tête vide ou deviné", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(requete({ authorization: "Bearer " }))).status).toBe(401);
    expect((await POST(requete({ authorization: "Bearer undefined" }))).status).toBe(401);
    expect(route.list).not.toHaveBeenCalled();
  });

  it("secret valide : efface seulement l'objet de 30 h, pas celui de 2 h, et ne renvoie que des nombres", async () => {
    route.list.mockImplementation(async (dossier: string) => {
      if (dossier === "") return { data: [{ name: "TEST_p1", id: null, created_at: null }], error: null };
      return {
        data: [
          { name: "TEST_deux-heures.jpg", id: "1", created_at: il_y_a(2) },
          { name: "TEST_trente-heures.jpg", id: "2", created_at: il_y_a(30) },
        ],
        error: null,
      };
    });
    route.remove.mockImplementation(async (objets: string[]) => ({ data: objets.map((name) => ({ name })), error: null }));
    const reponse = await POST(requete({ authorization: `Bearer ${SECRET}` }));
    expect(reponse.status).toBe(200);
    const corps = await reponse.json();
    expect(corps).toEqual({ ok: true, effaces: 1, echecs: 0 });
    expect(route.remove).toHaveBeenCalledTimes(1);
    expect(route.remove).toHaveBeenCalledWith(["TEST_p1/TEST_trente-heures.jpg"]);
    expect(JSON.stringify(corps)).not.toContain("TEST_");
    // La journalisation ne contient aucun nom d'objet.
    expect(vi.mocked(console.log).mock.calls.flat().join(" ")).not.toContain("TEST_");
  });

  it("schéma Bearer insensible à la casse, espaces tolérés", async () => {
    route.list.mockResolvedValue({ data: [], error: null });
    expect((await POST(requete({ authorization: `  bEaReR   ${SECRET} ` }))).status).toBe(200);
  });

  it("la route ne répond qu'en POST", async () => {
    const routeModule = await import("@/app/api/cron/purger-galerie-attente/route");
    expect("GET" in routeModule).toBe(false);
  });

  it("liste triée par nom ; l'âge est la dernière modification quand elle existe", async () => {
    route.list.mockImplementation(async (dossier: string) => {
      if (dossier === "") return { data: [{ name: "TEST_p1", id: null }], error: null };
      return { data: [{ name: "TEST_en-cours.jpg", id: "1", created_at: il_y_a(30), updated_at: il_y_a(1) }], error: null };
    });
    const reponse = await POST(requete({ authorization: `Bearer ${SECRET}` }));
    expect(await reponse.json()).toEqual({ ok: true, effaces: 0, echecs: 0 });
    expect(route.remove).not.toHaveBeenCalled();
    expect(route.list.mock.calls[0][1]).toMatchObject({ sortBy: { column: "name", order: "asc" } });
  });

  it("pagination de l'adaptateur réel : 100 entrées puis moins, offsets 0 et 100", async () => {
    const page = Array.from({ length: 100 }, (_, i) => ({ name: `TEST_f${i}.jpg`, id: String(i), created_at: il_y_a(30) }));
    route.list.mockImplementation(async (dossier: string, opts: { offset: number }) => {
      if (dossier === "") return { data: [{ name: "TEST_p1", id: null }], error: null };
      return { data: opts.offset === 0 ? page : [{ name: "TEST_dernier.jpg", id: "x", created_at: il_y_a(30) }], error: null };
    });
    route.remove.mockImplementation(async (objets: string[]) => ({ data: objets.map((name) => ({ name })), error: null }));
    const reponse = await POST(requete({ authorization: `Bearer ${SECRET}` }));
    expect(await reponse.json()).toEqual({ ok: true, effaces: 101, echecs: 0 });
    const offsets = route.list.mock.calls.filter((c) => c[0] === "TEST_p1").map((c) => c[1].offset);
    expect(offsets).toEqual([0, 100]);
  });

  it("échec partiel : ok false et statut 500", async () => {
    route.list.mockImplementation(async (dossier: string) =>
      dossier === "" ? { data: [{ name: "TEST_p1", id: null }], error: null } : { data: [{ name: "TEST_a.jpg", id: "1", created_at: il_y_a(30) }], error: null },
    );
    route.remove.mockResolvedValue({ data: null, error: { message: "TEST_refus" } });
    const reponse = await POST(requete({ authorization: `Bearer ${SECRET}` }));
    expect(reponse.status).toBe(500);
    expect(await reponse.json()).toEqual({ ok: false, effaces: 0, echecs: 1 });
  });

  it("lecture du bucket en échec : 500 sans détail", async () => {
    route.list.mockResolvedValue({ data: null, error: { message: "TEST_panne" } });
    const reponse = await POST(requete({ authorization: `Bearer ${SECRET}` }));
    expect(reponse.status).toBe(500);
    expect(await reponse.json()).toEqual({ ok: false });
  });
});
