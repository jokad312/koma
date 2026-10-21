import { describe, expect, it, vi } from "vitest";
import { demarrerGoogle, terminerGoogle } from "@/modules/comptes/service";
import { creerTestDependances, TEST_COMPTE_ID } from "../doubles/TEST_dependances-comptes";

const CHROME = "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36";
const INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/21C62 Instagram 315.1.2.30.114";
const SITE = { adresseSite: "http://localhost:3000" };

describe("demarrerGoogle", () => {
  it("Chrome : renvoie l'adresse de Supabase, la langue et le retour validé", async () => {
    const { deps, appels } = creerTestDependances();
    const r = await demarrerGoogle(deps, { langue: "en", retour: "/en/kits" }, { ...SITE, agent: CHROME });
    expect(r).toEqual({ ok: true, url: "https://TEST_fournisseur.invalid/autoriser", langue: "en", retour: "/en/kits" });
    expect(appels.oauth).toEqual([{ provider: "google", options: { redirectTo: "http://localhost:3000/auth/callback", skipBrowserRedirect: true } }]);
  });

  it("navigateur intégré : refusé sans appeler Supabase", async () => {
    const { deps, appels } = creerTestDependances();
    const r = await demarrerGoogle(deps, { langue: "fr" }, { ...SITE, agent: INSTAGRAM });
    expect(r).toEqual({ ok: false, erreur: "navigateur_integre" });
    expect(appels.oauth).toHaveLength(0);
  });

  it("retour hostile : accueil de la langue", async () => {
    const { deps } = creerTestDependances();
    const r = await demarrerGoogle(deps, { langue: "fr", retour: "https://x.fr" }, { ...SITE, agent: CHROME });
    expect(r).toMatchObject({ ok: true, retour: "/fr" });
  });

  it("erreur de Supabase ou adresse absente : erreur « google », aucune adresse journalisée", async () => {
    const trace = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = creerTestDependances({ oauth: { name: "AuthApiError", status: 500, code: "unexpected_failure" } });
    expect(await demarrerGoogle(a.deps, { langue: "fr" }, { ...SITE, agent: CHROME })).toEqual({ ok: false, erreur: "google" });
    const b = creerTestDependances({ urlOauth: null });
    expect(await demarrerGoogle(b.deps, { langue: "fr" }, { ...SITE, agent: CHROME })).toEqual({ ok: false, erreur: "google" });
    expect(trace.mock.calls.flat().join(" ")).not.toMatch(/https?:/);
    trace.mockRestore();
  });
});

describe("terminerGoogle", () => {
  it("nouveau Compte : langue définie par son propre auteur, étape « âge »", async () => {
    const { deps, appels } = creerTestDependances({ complet: false });
    const r = await terminerGoogle(deps, { code: "TEST_code", langue: "en", retour: "/en/kits" });
    expect(r).toEqual({ ok: true, etape: "age", retour: "/en/kits" });
    expect(appels.echanges).toEqual(["TEST_code"]);
    expect(appels.langues).toEqual([{ auteur: { type: "compte", id: TEST_COMPTE_ID, role: null }, compteId: TEST_COMPTE_ID, langue: "en" }]);
  });

  it("Compte complet : retour à la page quittée, langue intacte", async () => {
    const { deps, appels } = creerTestDependances({ complet: true });
    expect(await terminerGoogle(deps, { code: "TEST_code", langue: "fr", retour: "/fr/kits" })).toEqual({ ok: true, etape: "termine", retour: "/fr/kits" });
    expect(appels.langues).toHaveLength(0);
  });

  it("échec de la langue : la connexion continue", async () => {
    const trace = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = creerTestDependances({ complet: false, erreurLangue: "KS_LANGUE_INVALIDE" });
    expect(await terminerGoogle(deps, { code: "TEST_code", langue: "fr", retour: "/fr" })).toMatchObject({ ok: true, etape: "age" });
    trace.mockRestore();
  });

  it("code absent ou échange refusé : erreur « google »", async () => {
    const trace = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = creerTestDependances();
    expect(await terminerGoogle(a.deps, { code: null, langue: "fr", retour: "/fr" })).toEqual({ ok: false, erreur: "google" });
    expect(a.appels.echanges).toHaveLength(0);
    const b = creerTestDependances({ echange: { status: 400, code: "bad_code_verifier" } });
    expect(await terminerGoogle(b.deps, { code: "TEST_code", langue: "fr", retour: "/fr" })).toEqual({ ok: false, erreur: "google" });
    trace.mockRestore();
  });
});
