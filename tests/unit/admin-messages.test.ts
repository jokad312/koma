import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerTestDependancesAdmin, TEST_ADMIN_ID } from "../doubles/TEST_dependances-admin";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({
  deps: null as unknown,
  lecture: { data: null as unknown, error: null as unknown, count: null as number | null },
  requete: { filtre: null as unknown, tri: null as unknown, colonnes: null as unknown, options: null as unknown },
  rpc: vi.fn(),
}));
vi.mock("@/modules/admin/dependances", () => ({ dependances: () => faux.deps }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: faux.rpc,
    from: () => ({
      select: (colonnes: unknown, options: unknown) => {
        faux.requete.colonnes = colonnes;
        faux.requete.options = options;
        return {
          eq: (colonne: string, valeur: string) => {
            faux.requete.filtre = [colonne, valeur];
            const fin = Promise.resolve(faux.lecture);
            return Object.assign(fin, {
              order: (c: string, o: unknown) => {
                faux.requete.tri = [c, o];
                return Promise.resolve(faux.lecture);
              },
            });
          },
        };
      },
    }),
  }),
}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("@/lib/auth/droits", () => ({ exigerDroit: vi.fn() }));

import { marquerMessageTraite as action } from "@/modules/admin/actions";
import { compterMessagesNouveaux, lireMessagesNouveaux } from "@/modules/admin/queries";
import { marquerMessageTraite } from "@/modules/admin/service";

const ID = "00000000-0000-4000-8000-0000000000bb";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  faux.lecture = { data: null, error: null, count: null };
});
afterEach(() => vi.restoreAllMocks());

describe("marquerMessageTraite (service)", () => {
  it("droit « messages.traiter », puis écriture avec l'auteur : succès seulement après la réponse", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await marquerMessageTraite(deps, ID)).toEqual({ ok: true });
    expect(appels.ordre).toEqual(["droit", "message"]);
    expect(appels.droits).toEqual(["messages.traiter"]);
    expect(appels.messages).toEqual([{ auteur: { type: "compte", id: TEST_ADMIN_ID, role: "admin" }, id: ID }]);
  });

  it("droit refusé : rien n'est écrit", async () => {
    for (const droit of ["KS_NON_CONNECTE", "KS_DROIT_REFUSE"] as const) {
      const { deps, appels } = creerTestDependancesAdmin({ droit });
      expect(await marquerMessageTraite(deps, ID)).toEqual({ ok: false, erreur: "non_autorise" });
      expect(appels.messages).toEqual([]);
    }
  });

  it("identifiant invalide : refusé avant toute écriture", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await marquerMessageTraite(deps, "pas-un-uuid")).toEqual({ ok: false, erreur: "generique" });
    expect(appels.messages).toEqual([]);
  });

  it("message déjà traité ou inconnu, droit perdu en base, autre erreur : codes distincts, pas de succès", async () => {
    expect(await marquerMessageTraite(creerTestDependancesAdmin({ erreurMessage: "KS_MESSAGE_INTROUVABLE" }).deps, ID)).toEqual({ ok: false, erreur: "message_introuvable" });
    expect(await marquerMessageTraite(creerTestDependancesAdmin({ erreurMessage: "KS_DROIT_REFUSE" }).deps, ID)).toEqual({ ok: false, erreur: "non_autorise" });
    expect(await marquerMessageTraite(creerTestDependancesAdmin({ erreurMessage: "boum" }).deps, ID)).toEqual({ ok: false, erreur: "generique" });
  });
});

describe("Server Action marquerMessageTraite", () => {
  function formulaire(id: string) {
    const f = new FormData();
    f.set("id", id);
    return f;
  }

  it("succès et échec rendus avec l'identifiant du message", async () => {
    faux.deps = creerTestDependancesAdmin().deps;
    expect(await action(null, formulaire(ID))).toEqual({ statut: "succes", id: ID });
    faux.deps = creerTestDependancesAdmin({ erreurMessage: "boum" }).deps;
    expect(await action(null, formulaire(ID))).toEqual({ statut: "erreur", id: ID, erreur: "generique" });
  });

  it("erreur inattendue au contrôle du droit : refus, pas de succès", async () => {
    faux.deps = {
      exigerDroit: async () => {
        throw new Error("boum");
      },
    };
    expect(await action(null, formulaire(ID))).toMatchObject({ statut: "erreur", erreur: "non_autorise" });
  });
});

describe("câblage réel : marquer_message_traite", () => {
  it("appelle la fonction avec l'auteur et l'identifiant ; renvoie l'erreur de la base", async () => {
    const auteur = { type: "compte" as const, id: "TEST_admin", role: "admin" as const };
    faux.rpc.mockResolvedValue({ error: null });
    // Le module dépendances est simulé plus haut pour le service : on lit ici la vraie implémentation.
    const { dependances } = await vi.importActual<typeof import("@/modules/admin/dependances")>("@/modules/admin/dependances");
    expect(await dependances().marquerMessageTraite({ auteur, id: ID })).toEqual({ erreur: null });
    expect(faux.rpc).toHaveBeenCalledWith("marquer_message_traite", { p_auteur: auteur, p_id: ID });
    faux.rpc.mockResolvedValue({ error: { message: "KS_MESSAGE_INTROUVABLE" } });
    expect(await dependances().marquerMessageTraite({ auteur, id: ID })).toEqual({ erreur: "KS_MESSAGE_INTROUVABLE" });
  });
});

describe("lectures des messages", () => {
  it("liste : seulement les « nouveau », les plus récents d'abord, champs renommés", async () => {
    faux.lecture = { data: [{ id: ID, nom: "TEST_n", email: "TEST_e@example.invalid", message: "TEST_m", langue: "fr", cree_le: "2026-10-22T10:00:00Z" }], error: null, count: null };
    expect(await lireMessagesNouveaux()).toEqual([{ id: ID, nom: "TEST_n", email: "TEST_e@example.invalid", message: "TEST_m", langue: "fr", creeLe: "2026-10-22T10:00:00Z" }]);
    expect(faux.requete.filtre).toEqual(["statut", "nouveau"]);
    expect(faux.requete.tri).toEqual(["cree_le", { ascending: false }]);
  });

  it("liste : erreur de lecture, elle lève (jamais une liste vide inventée)", async () => {
    faux.lecture = { data: null, error: { message: "x" }, count: null };
    await expect(lireMessagesNouveaux()).rejects.toThrow();
  });

  it("compteur : le nombre de « nouveau » ; erreur : null, jamais un faux zéro", async () => {
    faux.lecture = { data: null, error: null, count: 4 };
    expect(await compterMessagesNouveaux()).toBe(4);
    expect(faux.requete.options).toEqual({ count: "exact", head: true });
    faux.lecture = { data: null, error: { message: "x" }, count: null };
    expect(await compterMessagesNouveaux()).toBeNull();
    faux.lecture = { data: null, error: null, count: null };
    expect(await compterMessagesNouveaux()).toBeNull();
  });
});
