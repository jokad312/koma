import { describe, expect, it } from "vitest";
import { choisirPrestataire, type EntreeAiguillage } from "@/modules/paiement/aiguillage";
import type { Achat, CodePrestataire, Couverture } from "@/modules/paiement/types";
import { estFamillePhysique, FAMILLES_PRODUIT } from "@/modules/catalogue/types";

const TOUS: CodePrestataire[] = ["pawapay", "maishapay", "polar"];
const ORDRE: CodePrestataire[] = ["pawapay", "maishapay"];
const COUVERTURE: Couverture = [
  { prestataire: "pawapay", pays: "CD", operateur: "TEST_op_a" },
  { prestataire: "maishapay", pays: "CD", operateur: "TEST_op_a" },
  { prestataire: "maishapay", pays: "CD", operateur: "TEST_op_b" },
];

function entree(s: Partial<EntreeAiguillage> & { achat: Achat }): EntreeAiguillage {
  return { moyen: "carte", pays: null, operateur: null, prestatairesActifs: TOUS, couverture: COUVERTURE, ordre: ORDRE, exclus: [], ...s };
}

const physique: Achat = { familles: ["cosplay"], estPass: false };
const accessoire: Achat = { familles: ["accessoire", "kit"], estPass: false };
const kits: Achat = { familles: ["kit"], estPass: false };
const mixte: Achat = { familles: ["cosplay", "kit"], estPass: false };
const pass: Achat = { familles: [], estPass: true };

describe("choisirPrestataire : carte (règle 10)", () => {
  it("Panier avec un Produit physique + carte : MaishaPay", () => {
    expect(choisirPrestataire(entree({ achat: physique }))).toEqual({ statut: "ok", prestataire: "maishapay" });
    expect(choisirPrestataire(entree({ achat: accessoire }))).toEqual({ statut: "ok", prestataire: "maishapay" });
  });
  it("Panier mixte (physique + Kit) + carte : MaishaPay, jamais Polar", () => {
    expect(choisirPrestataire(entree({ achat: mixte }))).toEqual({ statut: "ok", prestataire: "maishapay" });
  });
  it("Pass + carte : MaishaPay, jamais Polar", () => {
    expect(choisirPrestataire(entree({ achat: pass }))).toEqual({ statut: "ok", prestataire: "maishapay" });
  });
  it("Panier 100 % numérique + carte : Polar", () => {
    expect(choisirPrestataire(entree({ achat: kits }))).toEqual({ statut: "ok", prestataire: "polar" });
  });
  it("Panier 100 % numérique + carte, Polar inactif : « Carte indisponible », sans aucun remplaçant", () => {
    const sansPolar = TOUS.filter((c) => c !== "polar");
    expect(choisirPrestataire(entree({ achat: kits, prestatairesActifs: sansPolar }))).toEqual({ statut: "indisponible", raison: "carte_indisponible" });
  });
  it("Produit physique + carte, MaishaPay inactif : indisponible, Polar ne remplace jamais MaishaPay", () => {
    const sansMaisha = TOUS.filter((c) => c !== "maishapay");
    for (const achat of [physique, mixte, pass]) {
      expect(choisirPrestataire(entree({ achat, prestatairesActifs: sansMaisha }))).toEqual({ statut: "indisponible", raison: "carte_indisponible" });
    }
  });
  it("seul Polar actif : un Panier mixte ou un Pass n'a aucune carte", () => {
    for (const achat of [mixte, pass, physique]) {
      expect(choisirPrestataire(entree({ achat, prestatairesActifs: ["polar"] })).statut).toBe("indisponible");
    }
  });
  it("aucun Prestataire actif : indisponible", () => {
    expect(choisirPrestataire(entree({ achat: kits, prestatairesActifs: [] }))).toEqual({ statut: "indisponible", raison: "carte_indisponible" });
  });
  it("achat vide (aucune Famille, pas un Pass) : rien n'est inventé", () => {
    expect(choisirPrestataire(entree({ achat: { familles: [], estPass: false } })).statut).toBe("indisponible");
  });
});

describe("choisirPrestataire : mobile money (règle 9)", () => {
  const mm = (s: Partial<EntreeAiguillage> = {}) => entree({ achat: physique, moyen: "mobile_money", pays: "CD", operateur: "TEST_op_a", ...s });

  it("premier Agrégateur actif de l'Ordre de priorité qui couvre le couple", () => {
    expect(choisirPrestataire(mm())).toEqual({ statut: "ok", prestataire: "pawapay" });
  });
  it("l'Ordre de priorité décide, pas l'ordre alphabétique ni celui des Prestataires actifs", () => {
    expect(choisirPrestataire(mm({ ordre: ["maishapay", "pawapay"] }))).toEqual({ statut: "ok", prestataire: "maishapay" });
    expect(choisirPrestataire(mm({ ordre: ["pawapay", "maishapay"], prestatairesActifs: ["maishapay", "pawapay"] }))).toEqual({ statut: "ok", prestataire: "pawapay" });
  });
  it("un Agrégateur désactivé est ignoré : le suivant du même couple est proposé", () => {
    expect(choisirPrestataire(mm({ prestatairesActifs: ["maishapay", "polar"] }))).toEqual({ statut: "ok", prestataire: "maishapay" });
  });
  it("repli : l'Agrégateur dont une Tentative a échoué côté Prestataire est exclu, le suivant du même couple passe", () => {
    expect(choisirPrestataire(mm({ exclus: ["pawapay"] }))).toEqual({ statut: "ok", prestataire: "maishapay" });
  });
  it("tous les Agrégateurs du couple exclus : indisponible, aucun Prestataire inventé", () => {
    expect(choisirPrestataire(mm({ exclus: ["pawapay", "maishapay"] }))).toEqual({ statut: "indisponible", raison: "mobile_money_indisponible" });
  });
  it("un Agrégateur qui ne couvre pas le couple est sauté", () => {
    expect(choisirPrestataire(mm({ operateur: "TEST_op_b" }))).toEqual({ statut: "ok", prestataire: "maishapay" });
  });
  it("couple couvert par personne : indisponible", () => {
    expect(choisirPrestataire(mm({ operateur: "TEST_op_inconnu" })).statut).toBe("indisponible");
    expect(choisirPrestataire(mm({ pays: "TZ" })).statut).toBe("indisponible");
  });
  it("aucune Couverture saisie : indisponible", () => {
    expect(choisirPrestataire(mm({ couverture: [] }))).toEqual({ statut: "indisponible", raison: "mobile_money_indisponible" });
  });
  it("pays ou opérateur absent : indisponible", () => {
    expect(choisirPrestataire(mm({ pays: null })).statut).toBe("indisponible");
    expect(choisirPrestataire(mm({ operateur: null })).statut).toBe("indisponible");
  });
  it("Polar n'encaisse jamais de mobile money, même s'il figure dans l'ordre ou la couverture", () => {
    const couverture: Couverture = [...COUVERTURE, { prestataire: "polar", pays: "CD", operateur: "TEST_op_a" }];
    expect(choisirPrestataire(mm({ ordre: ["polar"], couverture, prestatairesActifs: ["polar"] })).statut).toBe("indisponible");
  });
  it("un Pass se paie par mobile money comme un autre achat", () => {
    expect(choisirPrestataire(mm({ achat: pass }))).toEqual({ statut: "ok", prestataire: "pawapay" });
  });
});

// Décision de Jonathan du 2026-11-15 (story 9.15) : Kit = numérique, TOUTE autre famille = physique, y compris une famille ajoutée plus tard.
// Le test parcourt les familles connues ET des familles futures ou inconnues : aucun panier contenant autre chose qu'un Kit ne part chez Polar.
describe("choisirPrestataire : toutes les familles (règle 10)", () => {
  const FAMILLES_A_TESTER = [...FAMILLES_PRODUIT, "vetement", "autre", "TEST_famille_future"] as const;

  it("estFamillePhysique : seul le Kit est numérique", () => {
    for (const f of FAMILLES_A_TESTER) expect(estFamillePhysique(f)).toBe(f !== "kit");
  });

  for (const famille of FAMILLES_A_TESTER.filter((f) => f !== "kit")) {
    it(`« ${famille} » seul, ou mêlé à un Kit, ou à un Pass, par carte : MaishaPay, jamais Polar`, () => {
      for (const familles of [[famille], [famille, "kit"], ["kit", famille]]) {
        const achat = { familles, estPass: false } as unknown as Achat;
        expect(choisirPrestataire(entree({ achat }))).toEqual({ statut: "ok", prestataire: "maishapay" });
        // Même si MaishaPay est inactif, Polar ne le remplace jamais.
        expect(choisirPrestataire(entree({ achat, prestatairesActifs: ["polar"] }))).toEqual({ statut: "indisponible", raison: "carte_indisponible" });
      }
      const avecPass = { familles: [famille], estPass: true } as unknown as Achat;
      expect(choisirPrestataire(entree({ achat: avecPass }))).toEqual({ statut: "ok", prestataire: "maishapay" });
    });
  }

  it("seuls des Kits, par carte : Polar", () => {
    expect(choisirPrestataire(entree({ achat: { familles: ["kit", "kit"], estPass: false } }))).toEqual({ statut: "ok", prestataire: "polar" });
  });
});
