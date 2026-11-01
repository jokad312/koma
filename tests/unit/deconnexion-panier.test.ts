import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ supprimes: [] as unknown[], fermeture: { ok: true } as { ok: boolean } }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ delete: (a: unknown) => etat.supprimes.push(a), set: vi.fn() }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/modules/comptes/dependances", () => ({ dependances: async () => ({}) }));
vi.mock("@/modules/comptes/service", () => ({ fermerSession: async () => etat.fermeture }));

import { deconnecter } from "@/modules/comptes/actions";

beforeEach(() => {
  etat.supprimes = [];
  etat.fermeture = { ok: true };
});

const formulaire = () => {
  const f = new FormData();
  f.set("langue", "fr");
  return f;
};

// Appareil partagé : le Panier d'un Compte ne doit pas rester lisible par le visiteur suivant.
describe("déconnexion et Panier", () => {
  it("efface le cookie du Panier quand la session est fermée", async () => {
    await expect(deconnecter({ erreur: false }, formulaire())).rejects.toThrow("REDIRECT:/fr");
    expect(etat.supprimes).toEqual([{ name: "koma_panier", path: "/" }]);
  });

  it("si la session n'a pas pu être fermée, le cookie reste (l'utilisateur est encore connecté)", async () => {
    etat.fermeture = { ok: false };
    await expect(deconnecter({ erreur: false }, formulaire())).resolves.toEqual({ erreur: true });
    expect(etat.supprimes).toEqual([]);
  });
});
