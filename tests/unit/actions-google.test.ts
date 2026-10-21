import { beforeEach, describe, expect, it, vi } from "vitest";
import { creerTestDependances } from "../doubles/TEST_dependances-comptes";

vi.mock("server-only", () => ({}));

const CHROME = "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36";
const INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/21C62 Instagram 315.1.2.30.114";

const etat = vi.hoisted(() => ({ agent: "" as string, poses: [] as unknown[][], reglages: undefined as unknown }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => etat.agent }),
  cookies: async () => ({ set: (...a: unknown[]) => etat.poses.push(a) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/modules/comptes/dependances", () => ({ dependances: async () => etat.reglages }));

import { connecterAvecGoogle } from "@/modules/comptes/actions";
import { COOKIE_RETOUR_GOOGLE, DUREE_RETOUR_GOOGLE_S } from "@/modules/comptes/google";

function formulaire(champs: Record<string, string>) {
  const f = new FormData();
  Object.entries(champs).forEach(([cle, valeur]) => f.set(cle, valeur));
  return f;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
  etat.poses = [];
  etat.reglages = creerTestDependances().deps;
});

describe("connecterAvecGoogle (action serveur)", () => {
  it("Chrome : pose le cookie httpOnly du retour validé puis redirige vers l'adresse de Supabase", async () => {
    etat.agent = CHROME;
    await expect(connecterAvecGoogle(null, formulaire({ langue: "en", retour: "/en/kits" }))).rejects.toThrow(
      "REDIRECT:https://TEST_fournisseur.invalid/autoriser",
    );
    expect(etat.poses).toHaveLength(1);
    const [nom, valeur, options] = etat.poses[0] as [string, string, Record<string, unknown>];
    expect(nom).toBe(COOKIE_RETOUR_GOOGLE);
    expect(JSON.parse(valeur)).toEqual({ langue: "en", retour: "/en/kits" });
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/auth", maxAge: DUREE_RETOUR_GOOGLE_S });
  });

  it("navigateur intégré : refus côté serveur, ni cookie ni redirection", async () => {
    etat.agent = INSTAGRAM;
    await expect(connecterAvecGoogle(null, formulaire({ langue: "fr" }))).resolves.toEqual({ erreur: "navigateur_integre" });
    expect(etat.poses).toHaveLength(0);
  });

  it("retour hostile ou langue invalide : accueil en français", async () => {
    etat.agent = CHROME;
    await expect(connecterAvecGoogle(null, formulaire({ langue: "xx", retour: "https://x.fr" }))).rejects.toThrow("REDIRECT:");
    expect(JSON.parse((etat.poses[0] as [string, string])[1])).toEqual({ langue: "fr", retour: "/fr" });
  });
});
