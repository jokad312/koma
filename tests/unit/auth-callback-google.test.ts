import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { creerTestDependances } from "../doubles/TEST_dependances-comptes";

vi.mock("server-only", () => ({}));

const etat = vi.hoisted(() => ({ cookie: undefined as string | undefined, supprimes: [] as unknown[], reglages: undefined as unknown }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (etat.cookie === undefined ? undefined : { value: etat.cookie }),
    delete: (c: unknown) => etat.supprimes.push(c),
  }),
}));
vi.mock("@/modules/comptes/dependances", () => ({ dependances: async () => etat.reglages }));

import { GET } from "@/app/auth/callback/route";

const appeler = (requete: string) => GET(new NextRequest(`http://localhost:3000/auth/callback${requete}`));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
  etat.cookie = JSON.stringify({ langue: "en", retour: "/en/kits" });
  etat.supprimes = [];
});

describe("GET /auth/callback", () => {
  it("Compte complet : retour à la page quittée, cookie supprimé", async () => {
    etat.reglages = creerTestDependances({ complet: true, questionsVues: true }).deps;
    const r = await appeler("?code=TEST_code");
    expect(r.headers.get("location")).toBe("http://localhost:3000/en/kits");
    expect(etat.supprimes).toHaveLength(1);
  });

  it("Compte incomplet : étape « âge » de la connexion, retour gardé", async () => {
    etat.reglages = creerTestDependances({ complet: false }).deps;
    const r = await appeler("?code=TEST_code");
    expect(r.headers.get("location")).toBe("http://localhost:3000/en/connexion?retour=%2Fen%2Fkits");
  });

  it("Compte complet qui n'a jamais vu les questions : étape « questions » de la connexion, retour gardé", async () => {
    etat.reglages = creerTestDependances({ complet: true, questionsVues: false }).deps;
    const r = await appeler("?code=TEST_code");
    expect(r.headers.get("location")).toBe("http://localhost:3000/en/connexion?retour=%2Fen%2Fkits");
  });

  it("refus ou annulation chez Google : connexion avec indicateur d'erreur, sans échange", async () => {
    const { deps, appels } = creerTestDependances();
    etat.reglages = deps;
    const r = await appeler("?error=access_denied&error_description=secret");
    expect(r.headers.get("location")).toBe("http://localhost:3000/en/connexion?retour=%2Fen%2Fkits&erreur=google");
    expect(appels.echanges).toHaveLength(0);
  });

  it("échange refusé : connexion avec indicateur d'erreur", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    etat.reglages = creerTestDependances({ echange: { status: 400 } }).deps;
    const r = await appeler("?code=TEST_code");
    expect(r.headers.get("location")).toBe("http://localhost:3000/en/connexion?retour=%2Fen%2Fkits&erreur=google");
  });

  it("cookie absent, illisible ou retour hostile : accueil en français, jamais une adresse externe", async () => {
    etat.reglages = creerTestDependances({ complet: true, questionsVues: true }).deps;
    etat.cookie = undefined;
    expect((await appeler("?code=TEST_code")).headers.get("location")).toBe("http://localhost:3000/fr");
    etat.cookie = "pas du json";
    expect((await appeler("?code=TEST_code")).headers.get("location")).toBe("http://localhost:3000/fr");
    etat.cookie = JSON.stringify({ langue: "fr", retour: "https://x.fr" });
    expect((await appeler("?code=TEST_code")).headers.get("location")).toBe("http://localhost:3000/fr");
  });
});
