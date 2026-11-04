import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Faux client de service : enregistre chaque filtre .eq() pour prouver que la liste ne lit que le Compte demandé.
const faux = vi.hoisted(() => ({
  eq: [] as Array<[string, unknown]>,
  limite: 0,
  commandes: [] as unknown[],
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => {
    let table = "";
    const constructeur: Record<string, unknown> = {
      from: (t: string) => {
        table = t;
        return constructeur;
      },
      select: () => constructeur,
      eq: (colonne: string, valeur: unknown) => {
        faux.eq.push([`${table}.${colonne}`, valeur]);
        return constructeur;
      },
      in: () => constructeur,
      order: () => constructeur,
      limit: (n: number) => {
        if (table === "commande") faux.limite = n;
        return constructeur;
      },
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: table === "commande" ? faux.commandes : [], error: null }).then(ok),
    };
    return constructeur;
  },
}));

import { droitAutorise } from "@/lib/auth/matrice-droits";
import { erreurBaseCommande } from "@/modules/commande/admin-service";
import { listerCommandes } from "@/modules/commande/queries";

beforeEach(() => {
  faux.eq = [];
  faux.limite = 0;
  faux.commandes = [];
});

const commande = (n: number) => ({ id: `id-${n}`, numero: `KS-2026-00000${n}`, statut: "payee", total_cents: 1000, expire_le: null, cree_le: "2026-11-01T10:00:00Z", offerte: false });

describe("listerCommandes : isolation entre Comptes et pagination (story 6.1)", () => {
  it("ne lit que les Commandes du Compte demandé (filtre compte_id), sans clé de l'appelant", async () => {
    await listerCommandes("TEST_compte_A", 12);
    expect(faux.eq).toContainEqual(["commande.compte_id", "TEST_compte_A"]);
    expect(faux.eq.filter(([c]) => c === "commande.compte_id")).toHaveLength(1);
  });
  it("lit une ligne de plus que la page pour savoir s'il en reste", async () => {
    faux.commandes = Array.from({ length: 13 }, (_, i) => commande(i));
    const r = await listerCommandes("TEST_compte_A", 12);
    expect(faux.limite).toBe(13);
    expect(r.commandes).toHaveLength(12);
    expect(r.reste).toBe(true);
  });
  it("page incomplète : plus rien après", async () => {
    faux.commandes = [commande(1), commande(2)];
    const r = await listerCommandes("TEST_compte_A", 12);
    expect(r.commandes).toHaveLength(2);
    expect(r.reste).toBe(false);
  });
  it("aucune commande : liste vide", async () => {
    expect(await listerCommandes("TEST_compte_A", 12)).toEqual({ commandes: [], reste: false });
  });
});

// Droits réels (pas de mock) : qui peut faire quoi sur les Commandes (matrice de droits, décision du 2026-11-04).
describe("droits des actions de l'epic 6 (matrice réelle)", () => {
  const roles = ["admin", "assistant", "benevole", null] as const;
  const attendu: Array<[string, Record<string, boolean>]> = [
    // Annulation, remboursement et réclamation : traiterDemande, confirmerRemboursement, avancerReclamation.
    ["remboursement.valider", { admin: true, assistant: false, benevole: false, null: false }],
    // Mesures reçues : admin et assistant.
    ["mesures.verifier", { admin: true, assistant: true, benevole: false, null: false }],
    // Avancement du statut.
    ["commandes.changer_statut", { admin: true, assistant: true, benevole: false, null: false }],
    ["commandes.voir", { admin: true, assistant: true, benevole: false, null: false }],
  ];
  for (const [droit, parRole] of attendu) {
    it(`${droit}`, () => {
      for (const r of roles) expect(droitAutorise(r, droit as never), `${droit} / ${String(r)}`).toBe(parRole[String(r)]);
    });
  }
});

describe("erreurBaseCommande : chaque code SQL a sa traduction", () => {
  const table: Array<[string, string]> = [
    ["KS_DROIT_REFUSE", "non_autorise"],
    ["KS_AUTEUR_MANQUANT", "non_autorise"],
    ["KS_COMMANDE_INTROUVABLE", "commande_introuvable"],
    ["KS_PAS_DE_LIVRAISON", "pas_de_livraison"],
    ["KS_TRANSITION_INTERDITE", "transition_interdite"],
    ["KS_MESURES_NON_RECUES", "mesures_non_recues"],
    ["KS_SUIVI_INVALIDE", "numero_suivi_invalide"],
    ["KS_MESURES_DEJA_RECUES", "mesures_deja_recues"],
    ["KS_PAS_SUR_MESURE", "pas_sur_mesure"],
    ["KS_ADRESSE_INVALIDE", "entree_invalide"],
    ["KS_LIGNE_INTROUVABLE", "commande_introuvable"],
    ["KS_ANNULATION_IMPOSSIBLE", "annulation_impossible"],
    ["KS_DEMANDE_INTROUVABLE", "demande_introuvable"],
    ["KS_DEMANDE_DEJA_TRAITEE", "demande_deja_traitee"],
    ["KS_PREUVE_REQUISE", "preuve_requise"],
    ["KS_STOCK_INSUFFISANT", "stock_insuffisant"],
    ["KS_STOCK_INVALIDE", "stock_invalide"],
    ["KS_ETAPE_INVALIDE", "etape_invalide"],
    ["KS_DEPUIS_STOCK_INVALIDE", "etape_invalide"],
    ["KS_DECISION_INVALIDE", "decision_invalide"],
    ["KS_TYPE_NON_PRIS_EN_CHARGE", "type_non_pris_en_charge"],
    ["KS_REMBOURSEMENT_NUL", "remboursement_nul"],
    ["KS_QUANTITE_INVALIDE", "quantite_invalide"],
    ["KS_STOCK_DEJA_VERIFIE", "stock_deja_verifie"],
    ["KS_REMBOURSEMENT_IMPOSSIBLE", "remboursement_impossible"],
    ["KS_TROP_PERCU_INTROUVABLE", "remboursement_impossible"],
  ];
  it.each(table)("%s -> %s", (code, attendu) => {
    expect(erreurBaseCommande(`erreur: ${code}`)).toBe(attendu);
  });
  it("code inconnu : générique", () => {
    expect(erreurBaseCommande("KS_INCONNU")).toBe("generique");
  });
});
