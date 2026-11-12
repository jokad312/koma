// Story 9.5 : Relances après achat. Rendu réel (creerDependancesEnvois().rendre) avec un faux client Supabase : un seul sujet, relu en base ; route
// /api/cron/relances (CRON_SECRET, POST seulement) ; réglage du rythme et textes FR/EN. Faux accès nommés TEST ; rien de réel.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  commences: 0,
  total: 0,
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", async () => {
  const reel = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...reel, connection: async () => {} };
});
vi.mock("resend", () => ({ Resend: class {} }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: etat.rpc,
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "TEST@example.invalid" } }, error: null }) } },
    from: (table: string) => {
      let lte = false;
      const chaine = {
        select: () => chaine,
        eq: () => chaine,
        lte: () => {
          lte = true;
          return chaine;
        },
        maybeSingle: async () => ({ data: etat.tables[table] ?? null, error: null }),
        // Comptage des chapitres : commencés (avec lte) ou total (sans).
        then: (ok: (v: unknown) => void) => ok({ count: lte ? etat.commences : etat.total, error: null }),
      };
      return chaine;
    },
  }),
}));

import { POST } from "@/app/api/cron/relances/route";
import { CLES_REGLAGE, relancesRythmeJoursSchema } from "@/modules/admin/schemas";
import { creerDependancesEnvois } from "@/modules/envois/dependances";
import type { EnvoiReserve } from "@/modules/envois/types";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const COMPTE = "00000000-0000-4000-8000-0000000000d1";
const envoi = (donnees: Record<string, string>, langue: "fr" | "en" = "fr"): EnvoiReserve => ({ id: "TEST_e", modele: "relance", compteId: COMPTE, langue, donnees, tentatives: 0 });
const rendre = (e: EnvoiReserve) => creerDependancesEnvois({ cleResend: "TEST", expediteur: "TEST@example.invalid" }).rendre(e);
const dans = (jours: number) => new Date(Date.now() + jours * 86_400_000).toISOString();

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle";
  process.env.DESINSCRIPTION_SECRET = "TEST_secret_de_desinscription_assez_long_0123456789";
  etat.tables = { reglage: { valeur: "TEST_Boutique" } };
  etat.commences = 0;
  etat.total = 0;
  etat.rpc.mockReset();
});

describe("rendu d'une Relance : un seul sujet, relu en base", () => {
  it("Kit commencé : chapitre suivant, lien vers la bibliothèque, désinscription ; sur le dernier chapitre on reprend ce dernier", async () => {
    etat.tables.produit = { slug: "test-kit", famille: "kit", titre_fr: "TEST_Kit", titre_en: null };
    etat.tables.acces_kit = { id: "TEST_a" };
    etat.tables.progression_video = { position_secondes: 300, max_position_secondes: 400, terminee_le: null };
    etat.commences = 2;
    etat.total = 5;
    const r = await rendre(envoi({ kit_id: "TEST_kit" }));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.texte).toContain("Passe au chapitre 3 de TEST_Kit.");
    expect(r.message.texte).toContain("https://test.example.invalid/fr/compte/bibliotheque/test-kit");
    expect(r.message.texte).toContain("/desinscription?c=");
    expect(r.message.entetes?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    etat.commences = 5;
    const dernier = await rendre(envoi({ kit_id: "TEST_kit" }));
    expect(dernier.statut === "pret" && dernier.message.texte).toContain("Passe au chapitre 5 de TEST_Kit.");
  });
  it("Kit : terminé, pas commencé, sans accès ou introuvable : ignoré", async () => {
    etat.tables.produit = { slug: "test-kit", famille: "kit", titre_fr: "TEST_Kit", titre_en: null };
    etat.tables.acces_kit = { id: "TEST_a" };
    etat.tables.progression_video = { position_secondes: 600, max_position_secondes: 600, terminee_le: "2026-11-09T00:00:00Z" };
    expect(await rendre(envoi({ kit_id: "TEST_kit" }))).toMatchObject({ statut: "ignorer", raison: "kit terminé" });
    etat.tables.progression_video = null;
    expect(await rendre(envoi({ kit_id: "TEST_kit" }))).toMatchObject({ statut: "ignorer", raison: "kit pas commencé" });
    etat.tables.acces_kit = null;
    expect(await rendre(envoi({ kit_id: "TEST_kit" }))).toMatchObject({ statut: "ignorer", raison: "kit sans accès" });
    etat.tables.produit = null;
    expect(await rendre(envoi({ kit_id: "TEST_kit" }))).toMatchObject({ statut: "ignorer", raison: "kit introuvable" });
  });
  it("Événement dans les 30 jours : prêt (titre, date, lien) ; passé, trop lointain ou non publié : ignoré", async () => {
    etat.tables.evenement = { slug: "test-fete", titre_fr: "TEST_Fête", titre_en: "TEST_Party", publie_le: dans(-2), debut_le: dans(10) };
    const r = await rendre(envoi({ evenement_id: "TEST_ev" }));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.sujet).toBe("TEST_Fête approche");
    expect(r.message.texte).toContain("https://test.example.invalid/fr/festival/test-fete");
    const anglais = await rendre(envoi({ evenement_id: "TEST_ev" }, "en"));
    expect(anglais.statut === "pret" && anglais.message.sujet).toBe("TEST_Party is coming up");
    etat.tables.evenement = { slug: "test-fete", titre_fr: "TEST_Fête", titre_en: null, publie_le: dans(-2), debut_le: dans(-1) };
    expect(await rendre(envoi({ evenement_id: "TEST_ev" }))).toMatchObject({ statut: "ignorer" });
    etat.tables.evenement = { slug: "test-fete", titre_fr: "TEST_Fête", titre_en: null, publie_le: dans(-2), debut_le: dans(45) };
    expect(await rendre(envoi({ evenement_id: "TEST_ev" }))).toMatchObject({ statut: "ignorer" });
    etat.tables.evenement = { slug: "test-fete", titre_fr: "TEST_Fête", titre_en: null, publie_le: null, debut_le: dans(10) };
    expect(await rendre(envoi({ evenement_id: "TEST_ev" }))).toMatchObject({ statut: "ignorer", raison: "Événement non publié" });
  });
  it("Nouveauté de son univers : prête ; non publiée ou sans univers : ignorée", async () => {
    etat.tables.produit = { slug: "test-cosplay", famille: "cosplay", titre_fr: "TEST_Cosplay", titre_en: null, publie_le: dans(-3), univers: { nom_fr: "TEST_Univers", nom_en: "TEST_Universe" } };
    const r = await rendre(envoi({ produit_id: "TEST_p" }));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.sujet).toBe("Nouveau dans TEST_Univers : TEST_Cosplay");
    expect(r.message.texte).toContain("/desinscription?c=");
    etat.tables.produit = { slug: "test-cosplay", famille: "cosplay", titre_fr: "TEST_Cosplay", titre_en: null, publie_le: dans(3), univers: { nom_fr: "TEST_Univers", nom_en: "TEST_Universe" } };
    expect(await rendre(envoi({ produit_id: "TEST_p" }))).toMatchObject({ statut: "ignorer", raison: "produit non publié" });
    etat.tables.produit = { slug: "test-cosplay", famille: "cosplay", titre_fr: "TEST_Cosplay", titre_en: null, publie_le: dans(-3), univers: null };
    expect(await rendre(envoi({ produit_id: "TEST_p" }))).toMatchObject({ statut: "ignorer", raison: "produit sans univers" });
  });
  it("sans sujet : ignorée", async () => {
    expect(await rendre(envoi({}))).toMatchObject({ statut: "ignorer", raison: "relance sans sujet" });
  });
});

describe("route /api/cron/relances", () => {
  const requete = (autorisation?: string) => new Request("https://test.example.invalid/api/cron/relances", { method: "POST", headers: autorisation ? { authorization: autorisation } : {} });
  beforeEach(() => {
    process.env.CRON_SECRET = "TEST_secret_cron_assez_long_0123456789abcdef";
  });
  it("sans secret ou avec un mauvais secret : 401, la base n'est pas appelée", async () => {
    expect((await POST(requete())).status).toBe(401);
    expect((await POST(requete("Bearer mauvais"))).status).toBe(401);
    expect(etat.rpc).not.toHaveBeenCalled();
  });
  it("avec le bon secret : planifie et rend un nombre seulement", async () => {
    etat.rpc.mockResolvedValue({ data: 4, error: null });
    const r = await POST(requete("Bearer TEST_secret_cron_assez_long_0123456789abcdef"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, planifiees: 4 });
    expect(etat.rpc).toHaveBeenCalledWith("planifier_relances");
  });
  it("erreur de la base : 500 sans détail", async () => {
    etat.rpc.mockResolvedValue({ data: null, error: { message: "TEST_panne" } });
    const r = await POST(requete("Bearer TEST_secret_cron_assez_long_0123456789abcdef"));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false });
  });
});

describe("réglage du rythme et textes", () => {
  it.each([
    ["3", "3"],
    [" 7 ", "7"],
    ["30", "30"],
    ["", null],
  ])("rythme %j → %j", (entree, attendu) => {
    expect(relancesRythmeJoursSchema.parse(entree)).toBe(attendu);
  });
  it.each(["0", "31", "-1", "2,5", "abc", "100"])("rythme refusé : %j", (entree) => {
    expect(relancesRythmeJoursSchema.safeParse(entree).success).toBe(false);
  });
  it("la clé est un réglage connu, textes FR et EN de mêmes clés et sans emoji", () => {
    expect((CLES_REGLAGE as readonly string[]).includes("relances_rythme_jours")).toBe(true);
    expect(Object.keys(fr.Emails.relance).sort()).toEqual(Object.keys(en.Emails.relance).sort());
    expect(Object.keys(fr.Admin.reglages.relancesRythme).sort()).toEqual(Object.keys(en.Admin.reglages.relancesRythme).sort());
    expect(fr.Admin.reglages.erreurs.relances_rythme_invalide).toBeTruthy();
    expect(en.Admin.reglages.erreurs.relances_rythme_invalide).toBeTruthy();
    expect(JSON.stringify([fr.Emails.relance, en.Emails.relance])).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
