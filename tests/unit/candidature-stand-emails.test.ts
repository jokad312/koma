// Story 7.11 : emails « candidature_validee » et « candidature_refusee » : gabarits FR/EN et rendu relu en base (jamais envoyé si la candidature a changé).
// Faux accès nommés TEST ; aucun vrai email.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  tables: {} as Record<string, { data: unknown; error: unknown }>,
}));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend: class { emails = { send: async () => ({ data: { id: "TEST_resend" }, error: null }) }; } }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "TEST@example.invalid" } }, error: null }) } },
    from: (table: string) => {
      const chaine: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "limit"]) chaine[m] = () => chaine;
      chaine.maybeSingle = async () => (table === "reglage" ? { data: { valeur: "TEST_Boutique" }, error: null } : (etat.tables[table] ?? { data: null, error: null }));
      chaine.then = (ok: (v: unknown) => unknown) => Promise.resolve(etat.tables[table] ?? { data: [], error: null }).then(ok);
      return chaine;
    },
  }),
}));

import { creerDependancesEnvois } from "@/modules/envois/dependances";
import { rendreCandidatureRefusee, rendreCandidatureValidee } from "@/modules/envois/modeles/candidature-stand";
import type { EnvoiReserve } from "@/modules/envois/types";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const COMPTE = "00000000-0000-4000-8000-0000000000d1";
const CAND = "00000000-0000-4000-8000-0000000000b1";
const URL_PAIEMENT = "https://test.example.invalid/fr/festival/test-fete/stand/" + CAND;

describe("gabarits candidature Stand", () => {
  it("acceptée : lien de paiement en bouton et en texte, échéance, rien de la candidature", () => {
    const m = rendreCandidatureValidee("fr", { nomSite: "TEST_Boutique", evenement: "TEST_<b>Fête</b>", limite: "13/11/2026 14:30", url: URL_PAIEMENT });
    expect(m.sujet).toBe("Ta place de Stand pour TEST_<b>Fête</b> est réservée");
    expect(m.html).toContain(`href="${URL_PAIEMENT}"`);
    expect(m.html).toContain("TEST_&lt;b&gt;Fête&lt;/b&gt;");
    expect(m.texte).toContain("13/11/2026 14:30");
    expect(m.texte).toContain(URL_PAIEMENT);
  });
  it("refusée : motif échappé, remboursement annoncé seulement s'il est dû", () => {
    const avec = rendreCandidatureRefusee("fr", { nomSite: "TEST_Boutique", evenement: "TEST_Fête", motif: "TEST_<i>Contrefaçon</i>", montantCents: 3200, url: "https://test.example.invalid/fr/compte/pass" });
    expect(avec.html).toContain("Motif : TEST_&lt;i&gt;Contrefaçon&lt;/i&gt;");
    expect(avec.texte).toContain("Nous te remboursons");
    const sans = rendreCandidatureRefusee("en", { nomSite: "TEST_Boutique", evenement: "TEST_Party", motif: null, montantCents: null, url: "https://test.example.invalid/en/compte/pass" });
    expect(sans.texte).not.toContain("refunded");
    expect(sans.texte).not.toContain("Reason");
    expect(sans.sujet).toBe("Your stand application for TEST_Party");
  });
  it("clés identiques FR et EN, sans emoji", () => {
    for (const k of ["candidature_validee", "candidature_refusee"] as const) {
      expect(Object.keys(fr.Emails[k]).sort()).toEqual(Object.keys(en.Emails[k]).sort());
    }
    expect(JSON.stringify([fr.Emails.candidature_validee, fr.Emails.candidature_refusee, en.Emails.candidature_validee, en.Emails.candidature_refusee])).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("rendu relu en base", () => {
  const dep = () => creerDependancesEnvois({ cleResend: "TEST", expediteur: "TEST@example.invalid" });
  const envoi = (modele: string, donnees: Record<string, string> = { candidature_id: CAND }): EnvoiReserve => ({ id: "TEST_e", modele, compteId: COMPTE, langue: "fr", donnees, tentatives: 0 });
  const evenement = { slug: "test-fete", titre_fr: "TEST_Fête", titre_en: "TEST_Party" };
  const demain = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const cand = (s: Record<string, unknown> = {}) => ({ data: { compte_id: COMPTE, statut: "validee", expire_le: demain(), motif_refus: null, commande_id: null, evenement, ...s }, error: null });
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle";
    etat.tables = { candidature_stand: cand() };
  });

  it("acceptée : prête, lien construit depuis NEXT_PUBLIC_SITE_URL avec le slug et l'identifiant", async () => {
    const r = await dep().rendre(envoi("candidature_validee"));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.html).toContain(`href="${URL_PAIEMENT}"`);
    expect(r.destinataire).toBe("TEST@example.invalid");
  });
  it.each([
    ["refusée entre-temps", { statut: "refusee" }],
    ["échue", { expire_le: new Date(Date.now() - 1000).toISOString() }],
    ["d'un autre Compte", { compte_id: "00000000-0000-4000-8000-0000000000d2" }],
  ])("acceptée ignorée : %s", async (_n, partiel) => {
    etat.tables = { candidature_stand: cand(partiel) };
    expect((await dep().rendre(envoi("candidature_validee"))).statut).toBe("ignorer");
  });
  it("introuvable ou sans identifiant : ignoré ; lecture en échec : à réessayer", async () => {
    etat.tables = { candidature_stand: { data: null, error: null } };
    expect((await dep().rendre(envoi("candidature_validee"))).statut).toBe("ignorer");
    expect(await dep().rendre(envoi("candidature_validee", {}))).toEqual({ statut: "ignorer", raison: "candidature non indiquée" });
    etat.tables = { candidature_stand: { data: null, error: { message: "TEST_panne" } } };
    expect((await dep().rendre(envoi("candidature_validee"))).statut).toBe("reessayer");
  });
  it("refusée : prête avec le motif ; jamais envoyée si la candidature n'est pas refusée", async () => {
    etat.tables = { candidature_stand: cand({ statut: "refusee", motif_refus: "TEST_motif" }) };
    const r = await dep().rendre(envoi("candidature_refusee"));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.texte).toContain("Motif : TEST_motif");
    expect(r.message.texte).not.toContain("Nous te remboursons");
    etat.tables = { candidature_stand: cand() };
    expect((await dep().rendre(envoi("candidature_refusee"))).statut).toBe("ignorer");
  });
  it("refusée après paiement : le montant vient du remboursement figé (USD seulement)", async () => {
    etat.tables = {
      candidature_stand: cand({ statut: "refusee", commande_id: "00000000-0000-4000-8000-0000000000c1" }),
      pass: { data: [{ id: "p1" }, { id: "p2" }], error: null },
      remboursement: { data: { montant_cents: 3200, devise: "USD" }, error: null },
    };
    const r = await dep().rendre(envoi("candidature_refusee"));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.texte).toContain("Nous te remboursons");
    etat.tables.remboursement = { data: { montant_cents: 3200, devise: "CDF" }, error: null };
    const h = await dep().rendre(envoi("candidature_refusee"));
    if (h.statut !== "pret") throw new Error("rendu attendu");
    expect(h.message.texte).not.toContain("Nous te remboursons");
  });
});
