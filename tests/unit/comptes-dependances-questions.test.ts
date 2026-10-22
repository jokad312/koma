import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({ rpc: faux.rpc, auth: { admin: {} } }) }));
vi.mock("@/lib/supabase/session", () => ({ creerClientSession: async () => ({ auth: {} }) }));

import { dependances } from "@/modules/comptes/dependances";

const AUTEUR = { type: "compte", id: "TEST_c", role: null };

beforeEach(() => {
  vi.clearAllMocks();
  faux.rpc.mockResolvedValue({ error: null });
});

describe("câblage réel de enregistrerQuestions", () => {
  it("avec un univers : p_univers transmis", async () => {
    const deps = await dependances();
    expect(await deps.enregistrerQuestions({ auteur: AUTEUR, compteId: "TEST_c", origine: "ami", preference: "porter", univers: "TEST_univers" })).toEqual({ erreur: null });
    expect(faux.rpc).toHaveBeenCalledWith("enregistrer_questions_accueil", {
      p_auteur: AUTEUR,
      p_compte: "TEST_c",
      p_origine: "ami",
      p_preference: "porter",
      p_univers: "TEST_univers",
    });
  });

  it("sans univers : p_univers absent de l'appel (valeur par défaut de la base)", async () => {
    const deps = await dependances();
    await deps.enregistrerQuestions({ auteur: AUTEUR, compteId: "TEST_c", origine: null, preference: null, univers: null });
    const args = faux.rpc.mock.calls[0][1];
    expect(args.p_univers).toBeUndefined();
    expect(args.p_compte).toBe("TEST_c");
  });

  it("erreur de la base : message renvoyé", async () => {
    faux.rpc.mockResolvedValue({ error: { message: "KS_REPONSE_INVALIDE" } });
    const deps = await dependances();
    expect(await deps.enregistrerQuestions({ auteur: AUTEUR, compteId: "TEST_c", origine: null, preference: null, univers: "x" })).toEqual({ erreur: "KS_REPONSE_INVALIDE" });
  });
});
