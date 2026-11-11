// Story 7.9 : demande d'annulation d'un Pass (service), emails « pass_annule » et « pass_rembourse » (gabarits et rendu relu en base).
// Faux accès nommés TEST ; aucun vrai paiement ni vrai email.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ commande: null as unknown, pass: null as unknown, remboursement: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async () => ({ data: { id: "TEST_resend" }, error: null }) };
  },
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "TEST@example.invalid" } }, error: null }) } },
    from: (table: string) => {
      const chaine = {
        select: () => chaine,
        eq: () => chaine,
        maybeSingle: async () => ({
          data: table === "commande" ? etat.commande : table === "pass" ? etat.pass : table === "remboursement" ? etat.remboursement : table === "reglage" ? { valeur: "TEST_Boutique" } : null,
          error: null,
        }),
      };
      return chaine;
    },
  }),
}));

import { demanderAnnulationPass } from "@/modules/evenements/annulation";
import { creerDependancesEnvois } from "@/modules/envois/dependances";
import { rendrePassAnnule, rendrePassRembourse } from "@/modules/envois/modeles/pass-statut";
import type { EnvoiReserve } from "@/modules/envois/types";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const PASS = "00000000-0000-4000-8000-0000000000f1";
const COMMANDE = "00000000-0000-4000-8000-0000000000c1";
const COMPTE = "00000000-0000-4000-8000-0000000000d1";

describe("demanderAnnulationPass", () => {
  const deps = (erreur: string | null = null, session: { compteId: string } | null = { compteId: COMPTE }) => ({
    session: vi.fn(async () => session),
    demander: vi.fn(async () => ({ erreur })),
  });

  it("le Compte vient de la session, jamais de la saisie", async () => {
    const d = deps();
    expect(await demanderAnnulationPass(d, { passId: PASS })).toEqual({ ok: true });
    expect(d.demander).toHaveBeenCalledWith(COMPTE, PASS);
  });
  it("refuse sans session et un identifiant mal formé, sans appeler la base", async () => {
    const d = deps(null, null);
    expect(await demanderAnnulationPass(d, { passId: PASS })).toEqual({ ok: false, erreur: "non_connecte" });
    expect(await demanderAnnulationPass(d, { passId: "pas-un-uuid" })).toEqual({ ok: false, erreur: "entree_invalide" });
    expect(d.demander).not.toHaveBeenCalled();
  });
  it.each([
    ["KS_ANNULATION_IMPOSSIBLE", "impossible"],
    ["KS_PASS_INTROUVABLE", "impossible"],
    ["KS_DEMANDE_EN_COURS", "deja"],
    ["KS_REGLAGE_MANQUANT", "reglage"],
    ["autre chose de la base", "generique"],
  ])("erreur de la base %s : %s", async (code, attendu) => {
    expect(await demanderAnnulationPass(deps(code), { passId: PASS })).toEqual({ ok: false, erreur: attendu });
  });
  it("une exception reste générique", async () => {
    const d = {
      session: vi.fn(async () => ({ compteId: COMPTE })),
      demander: vi.fn(async () => {
        throw new Error("TEST_panne");
      }),
    };
    expect(await demanderAnnulationPass(d, { passId: PASS })).toEqual({ ok: false, erreur: "generique" });
  });
});

const donnees = { nomSite: "TEST_Boutique", numero: "KS-2027-000001", url: "https://test.example.invalid/fr/compte/pass", nomTitulaire: "TEST_<b>Nom</b>", evenement: "TEST_Festival", montantCents: 2160 };

describe("gabarits pass_annule et pass_rembourse", () => {
  it("annulé : montant en USD, lien vers Mes Pass, aucune pièce jointe, noms échappés", () => {
    const m = rendrePassAnnule("fr", donnees);
    expect(m.sujet).toBe("L'annulation de ton Pass pour TEST_Festival est acceptée");
    expect(m.texte).toContain("21,60");
    expect(m.html).toContain("https://test.example.invalid/fr/compte/pass");
    expect(m.html).toContain("TEST_&lt;b&gt;Nom&lt;/b&gt;");
    expect(m.pieces).toBeUndefined();
  });
  it("remboursé, en anglais", () => {
    const m = rendrePassRembourse("en", donnees);
    expect(m.sujet).toBe("Your Pass for TEST_Festival is refunded");
    expect(m.texte).toContain("21.60");
  });
  it("clés identiques FR et EN, sans emoji", () => {
    for (const k of ["pass_annule", "pass_rembourse"] as const) {
      expect(Object.keys(fr.Emails[k]).sort()).toEqual(Object.keys(en.Emails[k]).sort());
    }
    const tout = JSON.stringify([fr.Emails.pass_annule, fr.Emails.pass_rembourse, en.Emails.pass_annule, en.Emails.pass_rembourse]);
    expect(tout).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("rendu relu en base", () => {
  const dep = () => creerDependancesEnvois({ cleResend: "TEST", expediteur: "TEST@example.invalid" });
  const envoi = (modele: "pass_annule" | "pass_rembourse", donneesEnvoi: Record<string, string> = { commande_id: COMMANDE, pass_id: PASS }): EnvoiReserve => ({
    id: "TEST_e",
    modele,
    compteId: COMPTE,
    langue: "fr",
    donnees: donneesEnvoi,
    tentatives: 0,
  });
  const passAnnule = { nom_titulaire: "TEST_Nom", statut: "annule", commande_id: COMMANDE, evenement: { titre_fr: "TEST_Festival", titre_en: null } };
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle";
    etat.commande = { id: COMMANDE, numero: "KS-2027-000001", compte_id: COMPTE, statut: "payee", total_cents: 3000, forfait_cents: 0, mode_remise: null, numero_suivi: null };
    etat.pass = passAnnule;
    etat.remboursement = { montant_cents: 2160, devise: "USD" };
  });

  it("pass_annule : prêt avec le montant figé", async () => {
    const r = await dep().rendre(envoi("pass_annule"));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.texte).toContain("21,60");
    expect(r.message.html).toContain("TEST_Festival");
  });
  it("pass_rembourse : ignoré tant que le Pass n'est pas « rembourse »", async () => {
    expect((await dep().rendre(envoi("pass_rembourse"))).statut).toBe("ignorer");
    etat.pass = { ...passAnnule, statut: "rembourse" };
    expect((await dep().rendre(envoi("pass_rembourse"))).statut).toBe("pret");
  });
  it("pass_annule : ignoré si le Pass est encore valide, d'une autre Commande, ou sans remboursement USD", async () => {
    etat.pass = { ...passAnnule, statut: "valide" };
    expect((await dep().rendre(envoi("pass_annule"))).statut).toBe("ignorer");
    etat.pass = { ...passAnnule, commande_id: "00000000-0000-4000-8000-0000000000c9" };
    expect((await dep().rendre(envoi("pass_annule"))).statut).toBe("ignorer");
    etat.pass = passAnnule;
    etat.remboursement = { montant_cents: 2160, devise: "CDF" };
    expect((await dep().rendre(envoi("pass_annule"))).statut).toBe("ignorer");
    etat.remboursement = null;
    expect((await dep().rendre(envoi("pass_annule"))).statut).toBe("ignorer");
  });
  it("sans identifiant de Pass : ignoré", async () => {
    expect(await dep().rendre(envoi("pass_annule", { commande_id: COMMANDE }))).toEqual({ statut: "ignorer", raison: "Pass non indiqué" });
  });
});
