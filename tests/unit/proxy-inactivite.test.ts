import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Faux client Supabase et faux réglage de test (règle 13 : tests uniquement).
const etat = vi.hoisted(() => ({ session: true, claimsErreur: false, deconnexions: 0, signOutEchoue: false, signOutErreur: false, role: undefined as string | undefined }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _cle: string,
    options: { cookies: { setAll: (c: { name: string; value: string; options: object }[]) => void } },
  ) => ({
    auth: {
      getClaims: async () =>
        etat.claimsErreur ? { data: null, error: { name: "TEST_Erreur" } } : { data: etat.session ? { claims: { sub: "TEST_compte", ...(etat.role ? { koma_role: etat.role } : {}) } } : null, error: null },
      signOut: async () => {
        etat.deconnexions += 1;
        if (etat.signOutEchoue) throw new Error("TEST_echec");
        if (etat.signOutErreur) return { error: { name: "TEST_ErreurSignOut" } };
        options.cookies.setAll([{ name: "sb-TEST-auth-token", value: "", options: { path: "/", maxAge: 0 } }]);
        return { error: null };
      },
    },
  }),
}));
vi.mock("@/lib/auth/inactivite", async (original) => ({
  ...(await original<typeof import("@/lib/auth/inactivite")>()),
  lireDelaiInactiviteMs: async () => 4 * 3_600_000,
}));

import { proxy } from "@/proxy";

const H = 3_600_000;
const demande = (chemin: string, cookies: Record<string, string>, methode = "GET", entetes: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${chemin}`, {
    method: methode,
    headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; "), ...entetes },
  });
const posés = (r: Response) => r.headers.getSetCookie();
const aCookie = (r: Response, nom: string, valeur?: string) => posés(r).some((c) => c.startsWith(`${nom}=${valeur ?? ""}`));
const effacé = (r: Response, nom: string) => posés(r).some((c) => c.startsWith(`${nom}=;`) && /max-age=0/i.test(c));

describe("proxy : déconnexion après inactivité", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle");
    Object.assign(etat, { session: true, claimsErreur: false, deconnexions: 0, signOutEchoue: false, signOutErreur: false, role: undefined });
  });
  afterEach(() => vi.unstubAllEnvs());

  const vieux = String(Date.now() - 5 * H);
  const cookieSession = { "sb-TEST-auth-token": "TEST_jeton" };

  it("actif : pas de déconnexion, pas de redirection", async () => {
    const r = await proxy(demande("/fr/compte", { ...cookieSession, koma_activite: String(Date.now() - 1000) }));
    expect(etat.deconnexions).toBe(0);
    expect(r.status).toBe(200);
  });

  it("expiré sur une page qui exige un compte : connexion avec retour et message, session fermée, panier intact", async () => {
    const r = await proxy(demande("/fr/compte/commandes?x=1", { ...cookieSession, koma_activite: vieux, panier: "TEST_panier" }));
    expect(etat.deconnexions).toBe(1);
    expect(r.status).toBe(307);
    const cible = new URL(r.headers.get("location")!);
    expect(cible.pathname).toBe("/fr/connexion");
    expect(cible.searchParams.get("retour")).toBe("/fr/compte/commandes?x=1");
    expect(cible.searchParams.get("expiree")).toBe("1");
    expect(effacé(r, "sb-TEST-auth-token")).toBe(true);
    expect(effacé(r, "koma_activite")).toBe(true);
    expect(posés(r).some((c) => c.startsWith("panier="))).toBe(false);
  });

  it("expiré sur une page publique : pas de redirection, visiteur, cookie du bandeau posé", async () => {
    const r = await proxy(demande("/fr/cosplays", { ...cookieSession, koma_activite: vieux }));
    expect(etat.deconnexions).toBe(1);
    expect(r.status).not.toBe(307);
    expect(aCookie(r, "koma_session_expiree", "1")).toBe(true);
    expect(effacé(r, "sb-TEST-auth-token")).toBe(true);
  });

  it("expiré sur une action (POST) d'une page protégée : session fermée, pas de redirection", async () => {
    const r = await proxy(demande("/fr/compte", { ...cookieSession, koma_activite: vieux }, "POST"));
    expect(etat.deconnexions).toBe(1);
    expect(r.status).not.toBe(307);
  });

  it("expiré sur une route hors langue : session fermée, pas de redirection", async () => {
    const r = await proxy(demande("/api/sante", { ...cookieSession, koma_activite: vieux }));
    expect(etat.deconnexions).toBe(1);
    expect(r.status).toBe(200);
  });

  it("signOut renvoie une erreur (sans lever) : erreur journalisée, la requête transmise n'a plus les cookies de session", async () => {
    etat.signOutErreur = true;
    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await proxy(demande("/fr/cosplays", { ...cookieSession, koma_activite: vieux, panier: "TEST_panier" }));
    expect(journal).toHaveBeenCalledWith(expect.stringContaining("TEST_ErreurSignOut"));
    expect(effacé(r, "sb-TEST-auth-token")).toBe(true);
    const transmis = r.headers.get("x-middleware-request-cookie") ?? "";
    expect(transmis).not.toContain("sb-TEST-auth-token");
    expect(transmis).toContain("panier=TEST_panier");
  });

  it("le cookie d'activité dure 400 jours", async () => {
    const r = await proxy(demande("/fr/compte", cookieSession));
    expect(posés(r).find((c) => c.startsWith("koma_activite="))).toMatch(/max-age=34560000/i);
  });

  it("« Voir le site » (?vue=site) : ni l'admin ni l'espace personnel ; « / » garde le paramètre", async () => {
    etat.role = "admin";
    const actif = { ...cookieSession, koma_activite: String(Date.now() - 1000), NEXT_LOCALE: "fr" };
    expect((await proxy(demande("/fr?vue=site", actif))).status).not.toBe(307);
    const racine = await proxy(demande("/?vue=site", actif));
    const cible = new URL(racine.headers.get("location")!);
    expect(cible.pathname).toBe("/fr");
    expect(cible.searchParams.get("vue")).toBe("site");
    etat.role = undefined;
    expect((await proxy(demande("/en?vue=site", actif))).status).not.toBe(307);
  });

  it("la révocation échoue : les cookies de session sont quand même retirés", async () => {
    etat.signOutEchoue = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await proxy(demande("/fr/admin", { ...cookieSession, koma_activite: vieux }));
    expect(r.status).toBe(307);
    expect(effacé(r, "sb-TEST-auth-token")).toBe(true);
  });

  it("session ancienne sans cookie d'activité : cookie posé, pas de coupure", async () => {
    const r = await proxy(demande("/fr/compte", cookieSession));
    expect(etat.deconnexions).toBe(0);
    expect(aCookie(r, "koma_activite")).toBe(true);
  });

  it("visiteur avec un vieux cookie d'activité : cookie supprimé, pas de message", async () => {
    etat.session = false;
    const r = await proxy(demande("/fr/cosplays", { koma_activite: vieux }));
    expect(etat.deconnexions).toBe(0);
    expect(effacé(r, "koma_activite")).toBe(true);
    expect(aCookie(r, "koma_session_expiree")).toBe(false);
  });

  it("Supabase muet : aucune déconnexion", async () => {
    etat.claimsErreur = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await proxy(demande("/fr/compte", { ...cookieSession, koma_activite: vieux }));
    expect(etat.deconnexions).toBe(0);
    expect(r.status).not.toBe(307);
  });

  it("reconnecté : le cookie du bandeau est retiré", async () => {
    const r = await proxy(demande("/fr/cosplays", { ...cookieSession, koma_activite: String(Date.now() - 1000), koma_session_expiree: "1" }));
    expect(effacé(r, "koma_session_expiree")).toBe(true);
  });

  it("client connecté (option A) : /fr et /en servent l'ancien accueil à la même adresse, aucune redirection vers l'espace personnel", async () => {
    const actif = { ...cookieSession, koma_activite: String(Date.now() - 1000) };
    for (const [chemin, langue] of [["/fr", "fr"], ["/en", "en"], ["/fr/", "fr"]] as const) {
      const r = await proxy(demande(chemin, actif));
      expect(r.headers.get("location") ?? "").not.toContain("/compte");
      // L'ancien accueil est servi à la même adresse (réécriture), jamais mis en cache partagé.
      expect(new URL(r.headers.get("x-middleware-rewrite")!).pathname).toBe(`/${langue}/accueil-connecte`);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
    }
    const r = await proxy(demande("/", actif, "GET", { "accept-language": "en-US,en;q=0.9" }));
    expect(new URL(r.headers.get("location")!).pathname).toBe("/en");
  });

  it("admin (koma_role) : /en, /en/compte et « / » mènent à /en/admin ; les pages publiques restent ouvertes", async () => {
    etat.role = "admin";
    const actif = { ...cookieSession, koma_activite: String(Date.now() - 1000), NEXT_LOCALE: "en" };
    for (const chemin of ["/en", "/en/compte", "/"]) {
      const r = await proxy(demande(chemin, actif));
      expect(r.status).toBe(307);
      expect(new URL(r.headers.get("location")!).pathname).toBe("/en/admin");
    }
    expect((await proxy(demande("/fr/cosplays", actif))).status).not.toBe(307);
    expect((await proxy(demande("/fr/compte/commandes", actif))).status).not.toBe(307);
    expect((await proxy(demande("/fr/admin", actif))).status).not.toBe(307);
  });

  it("assistant (koma_role) : /fr et /fr/compte mènent aux Commandes de l'admin", async () => {
    etat.role = "assistant";
    const actif = { ...cookieSession, koma_activite: String(Date.now() - 1000) };
    for (const chemin of ["/fr", "/fr/compte"]) {
      const r = await proxy(demande(chemin, actif));
      expect(new URL(r.headers.get("location")!).pathname).toBe("/fr/admin/commandes");
    }
  });

  it("jeton sans revendication de rôle (crochet absent) ou valeur inconnue : traité comme un client, ni /fr ni /compte ne sont redirigés", async () => {
    const actif = { ...cookieSession, koma_activite: String(Date.now() - 1000) };
    for (const role of [undefined, "benevole", "TEST_inconnu"]) {
      etat.role = role;
      expect((await proxy(demande("/fr", actif))).headers.get("location") ?? "").not.toContain("/compte");
      expect((await proxy(demande("/fr/compte", actif))).status).not.toBe(307);
    }
  });

  it("connectée : les autres pages et les requêtes non GET ne sont pas redirigées", async () => {
    const actif = { ...cookieSession, koma_activite: String(Date.now() - 1000) };
    expect((await proxy(demande("/fr/cosplays", actif))).status).not.toBe(307);
    expect((await proxy(demande("/fr", actif, "POST"))).status).not.toBe(307);
  });

  it("visiteur : l'accueil public n'est jamais redirigé ni réécrit", async () => {
    etat.session = false;
    const r = await proxy(demande("/fr", {}));
    expect(r.status).not.toBe(307);
    expect(r.headers.get("x-middleware-rewrite") ?? "").not.toContain("accueil-connecte");
  });

  it("session expirée sur l'accueil public : visiteur, pas de redirection vers l'espace personnel", async () => {
    const r = await proxy(demande("/fr", { ...cookieSession, koma_activite: vieux }));
    expect(etat.deconnexions).toBe(1);
    expect(r.status).not.toBe(307);
    expect(aCookie(r, "koma_session_expiree", "1")).toBe(true);
  });
});
