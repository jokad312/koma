// Story 9.15 : lectures et rendus serveur avec les nouvelles familles (faux client nommé TEST_, aucun appel réel).
import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ commande: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => {
    const requete = (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "not", "is", "in"]) b[m] = () => b;
      b.maybeSingle = async () => (table === "commande" ? { data: faux.commande, error: null } : { data: null, error: null });
      b.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
      return b;
    };
    return { from: requete, rpc: async () => ({ data: [], error: null }) };
  },
}));

import { lireCommande } from "@/modules/commande/queries";
import { avecVariante } from "@/modules/envois/dependances";
import { rendreCommandePayee } from "@/modules/envois/modeles/commande-payee";

const COMPTE = "00000000-0000-4000-8000-0000000000a1";
const NUMERO = "KS-2026-000901";

function commande(lignes: { famille: string; origine: string | null }[]) {
  return {
    id: "TEST_commande",
    numero: NUMERO,
    type: "produits",
    statut: "payee",
    sous_total_cents: 2000,
    forfait_cents: 0,
    total_cents: 2000,
    expire_le: null,
    zone: "goma",
    mode_remise: "retrait",
    offerte: false,
    cree_le: "2026-11-16T10:00:00Z",
    paye_le: "2026-11-16T10:05:00Z",
    fabrication_le: null,
    expediee_le: null,
    livree_le: null,
    numero_suivi: null,
    ligne_commande: lignes.map((l, i) => ({
      id: `TEST_l${i}`,
      prix_cents: 2000,
      nombre: 1,
      origine: l.origine,
      delai_fabrication_jours: l.origine === "fabrication" ? 7 : null,
      mesures_recues_le: null,
      titulaires: null,
      pass_nom_fr: null,
      pass_nom_en: null,
      produit: { slug: `test-${i}`, famille: l.famille, titre_fr: "TEST_Article", titre_en: null },
      variante: l.famille === "kit" ? null : { taille: l.famille === "autre" ? "unique" : "M", couleur_fr: l.famille === "vetement" ? "Noir" : null, couleur_en: l.famille === "vetement" ? "Black" : null },
      type_pass: null,
    })),
  };
}

beforeEach(() => {
  faux.commande = null;
});

describe("lireCommande : annulable (décision 10)", () => {
  it("Vêtement fabriqué sur commande, payé : annulable ; la couleur est lue dans la langue de la page", async () => {
    faux.commande = commande([{ famille: "vetement", origine: "fabrication" }]);
    const c = await lireCommande(COMPTE, NUMERO, "en");
    expect(c?.annulable).toBe(true);
    expect(c?.lignes[0].couleur).toBe("Black");
  });
  it("accessoire en stock seul : non annulable ; Autre article fabriqué sur commande avec un Kit : annulable", async () => {
    faux.commande = commande([{ famille: "accessoire", origine: "stock" }]);
    expect((await lireCommande(COMPTE, NUMERO, "fr"))?.annulable).toBe(false);
    faux.commande = commande([{ famille: "kit", origine: null }, { famille: "autre", origine: "fabrication" }]);
    expect((await lireCommande(COMPTE, NUMERO, "fr"))?.annulable).toBe(true);
  });
});

describe("email commande_payee : libellé des lignes", () => {
  it("Vêtement M Noir en anglais (« Black »), Autre article « Taille unique », Kit sans variante", () => {
    const lignes = [
      { titre: avecVariante("TEST_Polo", { taille: "M", couleur_fr: "Noir", couleur_en: "Black" }, "en"), nombre: 2, prixCents: 2000 },
      { titre: avecVariante("TEST_Objet", { taille: "unique", couleur_fr: null, couleur_en: null }, "en"), nombre: 1, prixCents: 1000 },
      { titre: avecVariante("TEST_Kit", null, "en"), nombre: 1, prixCents: 900 },
    ];
    expect(lignes.map((l) => l.titre)).toEqual(["TEST_Polo (Size M · Black)", "TEST_Objet (One size)", "TEST_Kit"]);
    expect(avecVariante("TEST_Objet", { taille: "unique" }, "fr")).toBe("TEST_Objet (Taille unique)");
    expect(avecVariante("TEST_Polo", { taille: "L", couleur_fr: "Noir", couleur_en: null }, "en")).toBe("TEST_Polo (Size L · Noir)");
    const m = rendreCommandePayee("en", { nomSite: "TEST_Boutique", numero: NUMERO, lignes, livraisonCents: 0, totalCents: 5900, url: "https://test.example.invalid/en/checkout/x" });
    expect(m.texte).toContain("TEST_Polo (Size M · Black)");
    expect(m.texte).toContain("TEST_Objet (One size)");
  });
  it("aucun motif spécial : « $& » et « {variante » d'un titre ou d'une couleur restent tels quels", () => {
    expect(avecVariante("TEST_$& {variante", { taille: "M", couleur_fr: "$1 {couleur}", couleur_en: null }, "fr")).toBe("TEST_$& {variante (Taille M · $1 {couleur})");
  });
});
