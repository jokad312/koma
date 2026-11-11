import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));

// redirect() et notFound() de Next interrompent le rendu en levant une erreur : on les imite pour lire leur destination.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`TEST_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("TEST_NOT_FOUND");
  },
}));

const etat = vi.hoisted(() => ({
  sub: null as string | null,
  roles: [] as string[],
  erreurRpc: false,
  // Événements pour lesquels la base reconnaît au Compte un accès bénévole valable maintenant (acces_scan_valide).
  acces: [] as string[],
  appelsAcces: 0,
}));

vi.mock("@/lib/supabase/session", () => ({
  creerClientSession: async () => ({
    auth: { getClaims: async () => ({ data: etat.sub ? { claims: { sub: etat.sub } } : null, error: etat.sub ? null : { name: "AuthSessionMissingError" } }) },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: async (nom: string, args: { p_role?: string; p_evenement?: string }) => {
      if (etat.erreurRpc) return { data: null, error: { message: "x" } };
      if (nom === "acces_scan_valide") {
        etat.appelsAcces += 1;
        return { data: etat.acces.includes(String(args.p_evenement)), error: null };
      }
      return { data: etat.roles.includes(String(args.p_role)), error: null };
    },
  }),
}));

import { DROITS, DroitRefuseError, exigerAccesScan, exigerAdminPage, exigerConnectePage, exigerDroit } from "@/lib/auth/droits";

const EVENEMENT_A = "00000000-0000-4000-8000-0000000000a1";
const EVENEMENT_B = "00000000-0000-4000-8000-0000000000b2";

beforeEach(() => {
  etat.sub = null;
  etat.roles = [];
  etat.erreurRpc = false;
  etat.acces = [];
  etat.appelsAcces = 0;
});

describe("exigerDroit", () => {
  it("refuse un visiteur", async () => {
    await expect(exigerDroit("reglages.modifier")).rejects.toMatchObject({ code: "KS_NON_CONNECTE" });
  });
  it("refuse un Compte sans rôle", async () => {
    etat.sub = "TEST_compte";
    await expect(exigerDroit("reglages.modifier")).rejects.toBeInstanceOf(DroitRefuseError);
    await expect(exigerDroit("reglages.modifier")).rejects.toMatchObject({ code: "KS_DROIT_REFUSE" });
  });
  it("refuse un bénévole", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["benevole"];
    await expect(exigerDroit("commandes.voir")).rejects.toMatchObject({ code: "KS_DROIT_REFUSE" });
  });
  it("accorde à l'assistant les droits de FR-53 seulement", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["assistant"];
    await expect(exigerDroit("commandes.voir")).resolves.toMatchObject({ auteur: { type: "compte", id: "TEST_compte", role: "assistant" } });
    await expect(exigerDroit("reglages.modifier")).rejects.toMatchObject({ code: "KS_DROIT_REFUSE" });
  });
  it("priorité de rôle : admin avant assistant, assistant avant bénévole", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["assistant", "admin"];
    await expect(exigerDroit("reglages.modifier")).resolves.toMatchObject({ auteur: { role: "admin" } });
    etat.roles = ["benevole", "assistant"];
    await expect(exigerDroit("commandes.voir")).resolves.toMatchObject({ auteur: { role: "assistant" } });
  });
  it("accorde tout à l'admin et met son rôle dans l'auteur", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["admin"];
    await expect(exigerDroit("reglages.modifier")).resolves.toEqual({
      compteId: "TEST_compte",
      auteur: { type: "compte", id: "TEST_compte", role: "admin" },
    });
  });
  it("refuse quand la vérification est impossible (jamais d'ouverture par défaut)", async () => {
    etat.sub = "TEST_compte";
    etat.erreurRpc = true;
    await expect(exigerDroit("reglages.modifier")).rejects.toMatchObject({ code: "KS_VERIFICATION_IMPOSSIBLE" });
  });
});

describe("exigerAdminPage", () => {
  it("visiteur : redirection vers la connexion avec le chemin de retour", async () => {
    await expect(exigerAdminPage("fr", "/admin/reglages")).rejects.toThrow("TEST_REDIRECT:/fr/connexion?retour=%2Ffr%2Fadmin%2Freglages");
  });
  it("Compte sans rôle : 404", async () => {
    etat.sub = "TEST_compte";
    await expect(exigerAdminPage("en", "/admin")).rejects.toThrow("TEST_NOT_FOUND");
  });
  it("assistant : 404 (aucun écran admin au lancement)", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["assistant"];
    await expect(exigerAdminPage("fr", "/admin")).rejects.toThrow("TEST_NOT_FOUND");
  });
  it("admin : accès", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["admin"];
    await expect(exigerAdminPage("fr", "/admin")).resolves.toMatchObject({ compteId: "TEST_compte" });
  });
  it("vérification impossible : l'erreur remonte, ni 404 ni accès", async () => {
    etat.sub = "TEST_compte";
    etat.erreurRpc = true;
    await expect(exigerAdminPage("fr", "/admin")).rejects.toMatchObject({ code: "KS_VERIFICATION_IMPOSSIBLE" });
  });
});

// Story 7.7 : le bénévole n'a aucun droit de la matrice ; il scanne seulement pour l'Événement de son accès valable.
describe("exigerAccesScan (accès bénévole)", () => {
  it("visiteur : non connecté", async () => {
    await expect(exigerAccesScan(EVENEMENT_A)).rejects.toMatchObject({ code: "KS_NON_CONNECTE" });
  });
  it("l'Admin scanne pour tout Événement, sans consulter les accès bénévoles", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["admin"];
    await expect(exigerAccesScan(EVENEMENT_B)).resolves.toEqual({ compteId: "TEST_compte", auteur: { type: "compte", id: "TEST_compte", role: "admin" } });
    expect(etat.appelsAcces).toBe(0);
  });
  it("un bénévole avec un accès valable passe pour cet Événement seulement", async () => {
    etat.sub = "TEST_compte";
    etat.acces = [EVENEMENT_A];
    await expect(exigerAccesScan(EVENEMENT_A)).resolves.toMatchObject({ compteId: "TEST_compte", auteur: { role: "benevole" } });
    await expect(exigerAccesScan(EVENEMENT_B)).rejects.toMatchObject({ code: "KS_DROIT_REFUSE" });
  });
  it("un Compte sans accès valable (jamais donné, pas encore ouvert ou échu : la base répond faux) est refusé", async () => {
    etat.sub = "TEST_compte";
    await expect(exigerAccesScan(EVENEMENT_A)).rejects.toMatchObject({ code: "KS_DROIT_REFUSE" });
  });
  it("l'Assistant n'a pas le Scan sans accès par Événement", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["assistant"];
    await expect(exigerAccesScan(EVENEMENT_A)).rejects.toMatchObject({ code: "KS_DROIT_REFUSE" });
  });
  it("vérification impossible : refus, jamais une ouverture par défaut", async () => {
    etat.sub = "TEST_compte";
    etat.acces = [EVENEMENT_A];
    etat.erreurRpc = true;
    await expect(exigerAccesScan(EVENEMENT_A)).rejects.toMatchObject({ code: "KS_VERIFICATION_IMPOSSIBLE" });
  });
});

describe("un bénévole avec un accès valable n'obtient aucun autre droit", () => {
  it("exigerDroit refuse chacun des droits de la matrice, y compris pass.scanner", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["benevole"];
    etat.acces = [EVENEMENT_A];
    for (const droit of DROITS) await expect(exigerDroit(droit), droit).rejects.toMatchObject({ code: "KS_DROIT_REFUSE" });
  });
  it("les pages admin lui rendent un 404", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["benevole"];
    etat.acces = [EVENEMENT_A];
    await expect(exigerAdminPage("fr", "/admin")).rejects.toThrow("TEST_NOT_FOUND");
    await expect(exigerAdminPage("fr", "/admin/commandes", "commandes.voir")).rejects.toThrow("TEST_NOT_FOUND");
    await expect(exigerAdminPage("fr", `/admin/evenements/${EVENEMENT_A}`, "evenements.gerer")).rejects.toThrow("TEST_NOT_FOUND");
    await expect(exigerAdminPage("fr", `/admin/evenements/${EVENEMENT_A}`, "benevoles.acces")).rejects.toThrow("TEST_NOT_FOUND");
    await expect(exigerAdminPage("fr", "/scan", "pass.scanner")).rejects.toThrow("TEST_NOT_FOUND");
  });
  it("même sans rôle, avec un accès valable : 404 sur les pages admin", async () => {
    etat.sub = "TEST_compte";
    etat.acces = [EVENEMENT_A];
    await expect(exigerAdminPage("fr", "/admin")).rejects.toThrow("TEST_NOT_FOUND");
  });
});

describe("exigerConnectePage (page de Scan)", () => {
  it("visiteur : redirection vers la connexion avec retour", async () => {
    await expect(exigerConnectePage("fr", "/scan")).rejects.toThrow("TEST_REDIRECT:/fr/connexion?retour=%2Ffr%2Fscan");
  });
  it("rend le Compte et son rôle", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["admin"];
    await expect(exigerConnectePage("fr", "/scan")).resolves.toEqual({ compteId: "TEST_compte", role: "admin" });
    etat.roles = [];
    await expect(exigerConnectePage("fr", "/scan")).resolves.toEqual({ compteId: "TEST_compte", role: null });
  });
  it("vérification impossible : l'erreur remonte", async () => {
    etat.sub = "TEST_compte";
    etat.erreurRpc = true;
    await expect(exigerConnectePage("fr", "/scan")).rejects.toMatchObject({ code: "KS_VERIFICATION_IMPOSSIBLE" });
  });
});
