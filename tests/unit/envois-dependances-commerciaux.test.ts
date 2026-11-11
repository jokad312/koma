// Story 9.6 : rendu réel des emails ciblés (creerDependancesEnvois().rendre) avec un faux client Supabase : un email dont le sujet n'est plus
// vrai n'est jamais envoyé ; chapitre, liens et désinscription.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Tables = Record<string, unknown>;
const etat = vi.hoisted(() => ({ tables: {} as Record<string, unknown>, chapitres: 0, envois: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async (args: unknown) => (etat.envois.push(args), { data: { id: "TEST_resend" }, error: null }) };
  },
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "TEST@example.invalid" } }, error: null }) } },
    from: (table: string) => {
      const chaine = {
        select: () => chaine,
        eq: () => chaine,
        lte: () => chaine,
        maybeSingle: async () => ({ data: (etat.tables as Tables)[table] ?? null, error: null }),
        // Requête de comptage (chapitre_kit) : attendue directement.
        then: (ok: (v: unknown) => void) => ok({ count: etat.chapitres, error: null }),
      };
      return chaine;
    },
  }),
}));

import { creerDependancesEnvois } from "@/modules/envois/dependances";
import type { EnvoiReserve } from "@/modules/envois/types";

const COMPTE = "00000000-0000-4000-8000-0000000000d1";
const envoi = (modele: string, donnees: Record<string, string>): EnvoiReserve => ({ id: "TEST_e", modele, compteId: COMPTE, langue: "fr", donnees, tentatives: 0 });
const rendre = (e: EnvoiReserve) => creerDependancesEnvois({ cleResend: "TEST", expediteur: "TEST@example.invalid" }).rendre(e);
const produit = (s: Record<string, unknown> = {}) => ({ id: "TEST_p", slug: "test-kit", famille: "kit", titre_fr: "TEST_Kit", titre_en: null, publie_le: "2026-11-01T00:00:00Z", univers: { nom_fr: "TEST_Univers", nom_en: "TEST_Universe" }, ...s });

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle";
  process.env.DESINSCRIPTION_SECRET = "TEST_secret_de_desinscription_assez_long_0123456789";
  etat.tables = { reglage: { valeur: "TEST_Boutique" } };
  etat.chapitres = 0;
});

describe("rendu des emails ciblés", () => {
  it("RFC 8058 : List-Unsubscribe vers la route POST signée et List-Unsubscribe-Post, transmis à Resend", async () => {
    etat.tables.panier = { compte_id: COMPTE, ligne_panier: [{ id: "l1" }] };
    const r = await rendre(envoi("panier_abandonne", { panier_id: "TEST_panier" }));
    if (r.statut !== "pret") throw new Error("rendu attendu");
    expect(r.message.entetes?.["List-Unsubscribe"]).toMatch(/^<https:\/\/test\.example\.invalid\/api\/desinscription\?c=[0-9a-f-]{36}&s=[A-Za-z0-9_-]+>$/);
    expect(r.message.entetes?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    await creerDependancesEnvois({ cleResend: "TEST", expediteur: "TEST@example.invalid" }).envoyer({ envoiId: "TEST_e", destinataire: "TEST@example.invalid", message: r.message });
    expect(etat.envois.at(-1)).toMatchObject({ headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
  });

  it("RFC 8058 : le rappel de Kit et le nouveau produit portent aussi les deux en-têtes", async () => {
    etat.tables.produit = produit();
    etat.tables.acces_kit = { id: "TEST_a" };
    etat.tables.progression_video = null;
    for (const modele of ["rappel_kit", "nouveau_produit"]) {
      const r = await rendre(envoi(modele, { produit_id: "TEST_p" }));
      if (r.statut !== "pret") throw new Error(`rendu attendu pour ${modele}`);
      expect(r.message.entetes?.["List-Unsubscribe"]).toContain("/api/desinscription?c=");
      expect(r.message.entetes?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    }
  });

  it("panier : prêt s'il a des lignes (lien vers le panier, désinscription) ; vide ou d'un autre Compte : ignoré", async () => {
    etat.tables.panier = { compte_id: COMPTE, ligne_panier: [{ id: "l1" }] };
    const r = await rendre(envoi("panier_abandonne", { panier_id: "TEST_panier" }));
    expect(r.statut).toBe("pret");
    expect(r.statut === "pret" && r.message.texte).toContain("https://test.example.invalid/fr/panier");
    expect(r.statut === "pret" && r.message.texte).toContain("https://test.example.invalid/fr/desinscription?c=");
    etat.tables.panier = { compte_id: COMPTE, ligne_panier: [] };
    expect(await rendre(envoi("panier_abandonne", { panier_id: "TEST_panier" }))).toMatchObject({ statut: "ignorer" });
    etat.tables.panier = { compte_id: "00000000-0000-4000-8000-0000000000ff", ligne_panier: [{ id: "l1" }] };
    expect(await rendre(envoi("panier_abandonne", { panier_id: "TEST_panier" }))).toMatchObject({ statut: "ignorer" });
  });

  it("rappel de Kit : chapitre 1 si pas démarré, chapitre en cours sinon ; terminé ou sans accès : ignoré", async () => {
    etat.tables.produit = produit();
    etat.tables.acces_kit = { id: "TEST_a" };
    etat.tables.progression_video = null;
    const debut = await rendre(envoi("rappel_kit", { produit_id: "TEST_p" }));
    expect(debut.statut === "pret" && debut.message.texte).toContain("Commence le chapitre 1 de TEST_Kit.");
    expect(debut.statut === "pret" && debut.message.texte).toContain("https://test.example.invalid/fr/compte/bibliotheque/test-kit");
    etat.tables.progression_video = { position_secondes: 300, max_position_secondes: 400, terminee_le: null };
    etat.chapitres = 3;
    const reprise = await rendre(envoi("rappel_kit", { produit_id: "TEST_p" }));
    expect(reprise.statut === "pret" && reprise.message.texte).toContain("Reprends au chapitre 3 de TEST_Kit.");
    etat.tables.progression_video = { position_secondes: 600, max_position_secondes: 600, terminee_le: "2026-11-09T00:00:00Z" };
    expect(await rendre(envoi("rappel_kit", { produit_id: "TEST_p" }))).toMatchObject({ statut: "ignorer", raison: "kit terminé" });
    etat.tables.acces_kit = null;
    expect(await rendre(envoi("rappel_kit", { produit_id: "TEST_p" }))).toMatchObject({ statut: "ignorer", raison: "kit sans accès" });
  });

  it("nouveau produit : lien selon la famille et la langue ; non publié ou futur : ignoré", async () => {
    etat.tables.produit = produit({ famille: "accessoire", slug: "test-masque", titre_fr: "TEST_Masque" });
    const r = await rendre({ ...envoi("nouveau_produit", { produit_id: "TEST_p" }), langue: "en" });
    expect(r.statut === "pret" && r.message.sujet).toBe("New in TEST_Universe: TEST_Masque");
    expect(r.statut === "pret" && r.message.texte).toContain("https://test.example.invalid/en/accessories/test-masque");
    etat.tables.produit = produit({ publie_le: null });
    expect(await rendre(envoi("nouveau_produit", { produit_id: "TEST_p" }))).toMatchObject({ statut: "ignorer" });
    etat.tables.produit = produit({ publie_le: "2999-01-01T00:00:00Z" });
    expect(await rendre(envoi("nouveau_produit", { produit_id: "TEST_p" }))).toMatchObject({ statut: "ignorer" });
  });

  it("clé de désinscription absente : jamais d'email commercial sans lien (nouvel essai)", async () => {
    delete process.env.DESINSCRIPTION_SECRET;
    etat.tables.panier = { compte_id: COMPTE, ligne_panier: [{ id: "l1" }] };
    expect(await rendre(envoi("panier_abandonne", { panier_id: "TEST_panier" }))).toMatchObject({ statut: "reessayer" });
  });

  it("relance (sans gabarit) : ignorée, jamais lue comme une Commande ; l'alerte a son gabarit (story 7.3) et refuse un envoi sans inscription", async () => {
    expect(await rendre(envoi("relance", {}))).toEqual({ statut: "ignorer", raison: "modèle sans gabarit" });
    expect(await rendre(envoi("alerte_evenement", {}))).toEqual({ statut: "ignorer", raison: "inscription non indiquée" });
  });
});
