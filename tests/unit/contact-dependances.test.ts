import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({ rpc: vi.fn(), entetes: new Map<string, string>() }));
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({ rpc: faux.rpc }) }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (nom: string) => faux.entetes.get(nom) ?? null }) }));
vi.mock("@/lib/env", () => ({ lireEnvServeur: () => ({ SUPABASE_SECRET_KEY: "TEST_cle_secrete" }) }));

import { dependances } from "@/modules/contact/dependances";

beforeEach(() => {
  vi.clearAllMocks();
  faux.entetes.clear();
});

describe("câblage réel de modules/contact", () => {
  it("empreinte : hachage de l'adresse (première de x-forwarded-for), jamais l'adresse brute", async () => {
    faux.entetes.set("x-forwarded-for", "203.0.113.7, 10.0.0.1");
    const a = await dependances().empreinteClient();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("203.0.113.7");
    faux.entetes.set("x-forwarded-for", "203.0.113.7");
    expect(await dependances().empreinteClient()).toBe(a);
    faux.entetes.set("x-forwarded-for", "203.0.113.8");
    expect(await dependances().empreinteClient()).not.toBe(a);
  });

  it("x-real-ip en repli, puis null sans adresse", async () => {
    faux.entetes.set("x-real-ip", "203.0.113.9");
    expect(await dependances().empreinteClient()).toMatch(/^[0-9a-f]{64}$/);
    faux.entetes.clear();
    expect(await dependances().empreinteClient()).toBeNull();
  });

  it("consommerEssai : data === true autorise ; faux ou erreur n'autorise pas", async () => {
    faux.rpc.mockResolvedValue({ data: true, error: null });
    expect(await dependances().consommerEssai({ cle: "contact:x", fenetreSecondes: 3600, maximum: 5 })).toEqual({ erreur: null, autorise: true });
    expect(faux.rpc).toHaveBeenCalledWith("consommer_essai", { p_cle: "contact:x", p_fenetre_secondes: 3600, p_maximum: 5 });
    faux.rpc.mockResolvedValue({ data: false, error: null });
    expect((await dependances().consommerEssai({ cle: "contact:x", fenetreSecondes: 3600, maximum: 5 })).autorise).toBe(false);
    faux.rpc.mockResolvedValue({ data: null, error: { message: "KS_LIMITE_INVALIDE" } });
    expect(await dependances().consommerEssai({ cle: "contact:x", fenetreSecondes: 3600, maximum: 5 })).toEqual({ erreur: "KS_LIMITE_INVALIDE", autorise: false });
  });

  it("enregistrerMessage appelle enregistrer_message_contact avec l'auteur visiteur", async () => {
    faux.rpc.mockResolvedValue({ error: null });
    const auteur = { type: "visiteur" as const };
    expect(await dependances().enregistrerMessage({ auteur, nom: "TEST_n", email: "TEST_e@example.invalid", message: "TEST_m", langue: "fr" })).toEqual({ erreur: null });
    expect(faux.rpc).toHaveBeenCalledWith("enregistrer_message_contact", {
      p_auteur: auteur,
      p_nom: "TEST_n",
      p_email: "TEST_e@example.invalid",
      p_message: "TEST_m",
      p_langue: "fr",
    });
    faux.rpc.mockResolvedValue({ error: { message: "KS_MESSAGE_INVALIDE" } });
    expect(await dependances().enregistrerMessage({ auteur, nom: "n", email: "e", message: "m", langue: "fr" })).toEqual({ erreur: "KS_MESSAGE_INVALIDE" });
  });
});
