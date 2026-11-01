import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ appels: [] as { nom: string; args: Record<string, unknown> }[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: vi.fn() }) }));
vi.mock("@/lib/auth/compte", () => ({ lireSessionVerifiee: async () => null }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: async (nom: string, args: Record<string, unknown>) => {
      etat.appels.push({ nom, args });
      return { data: null, error: null };
    },
  }),
}));

import { dependances } from "@/modules/panier/dependances";

const ID = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  etat.appels = [];
});

// PostgREST retire les clés « undefined » du JSON : une fonction SQL sans valeur par défaut ne serait alors plus trouvée.
// Chaque paramètre doit donc toujours être envoyé, au besoin à null.
describe("arguments des appels RPC du Panier", () => {
  it("ajouter_au_panier envoie p_compte et p_taille même sans Compte ni taille (Kit, visiteur)", async () => {
    await dependances().ajouter({ auteur: { type: "visiteur" }, panierId: ID, compteId: null, produitId: ID, taille: null, nombre: 1 });
    const { args } = etat.appels[0];
    expect(Object.keys(args).sort()).toEqual(["p_auteur", "p_compte", "p_nombre", "p_panier", "p_produit", "p_taille"]);
    expect(args.p_compte).toBeNull();
    expect(args.p_taille).toBeNull();
    expect(Object.values(args).every((v) => v !== undefined)).toBe(true);
  });
  it("les autres appels n'envoient aucune valeur indéfinie", async () => {
    const d = dependances();
    await d.creerPanier({ type: "visiteur" });
    await d.modifier({ auteur: { type: "visiteur" }, panierId: ID, ligneId: ID, nombre: 2 });
    await d.retirer({ auteur: { type: "visiteur" }, panierId: ID, ligneId: ID });
    await d.lire(ID);
    await d.compter(ID);
    for (const a of etat.appels) expect(Object.values(a.args).every((v) => v !== undefined)).toBe(true);
  });
});
