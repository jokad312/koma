import { describe, expect, it } from "vitest";
import { choisirPrestataire, type EntreeAiguillage } from "@/modules/paiement/aiguillage";
import type { Achat, CodePrestataire, Couverture } from "@/modules/paiement/types";

const TOUS: CodePrestataire[] = ["pawapay", "kpay", "maishapay", "polar"];
const ORDRE: CodePrestataire[] = ["pawapay", "kpay", "maishapay"];
const COUVERTURE: Couverture = [
  { prestataire: "pawapay", pays: "CD", operateur: "TEST_op_a" },
  { prestataire: "kpay", pays: "CD", operateur: "TEST_op_a" },
  { prestataire: "maishapay", pays: "CD", operateur: "TEST_op_a" },
  { prestataire: "kpay", pays: "CD", operateur: "TEST_op_b" },
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
  it("Panier avec un Produit physique + carte : K-Pay", () => {
    expect(choisirPrestataire(entree({ achat: physique }))).toEqual({ statut: "ok", prestataire: "kpay" });
    expect(choisirPrestataire(entree({ achat: accessoire }))).toEqual({ statut: "ok", prestataire: "kpay" });
  });
  it("Panier mixte (physique + Kit) + carte : K-Pay, jamais Polar", () => {
    expect(choisirPrestataire(entree({ achat: mixte }))).toEqual({ statut: "ok", prestataire: "kpay" });
  });
  it("Pass + carte : K-Pay, jamais Polar", () => {
    expect(choisirPrestataire(entree({ achat: pass }))).toEqual({ statut: "ok", prestataire: "kpay" });
  });
  it("Panier 100 % numérique + carte : Polar", () => {
    expect(choisirPrestataire(entree({ achat: kits }))).toEqual({ statut: "ok", prestataire: "polar" });
  });
  it("Panier 100 % numérique + carte, Polar inactif : « Carte indisponible », sans aucun remplaçant", () => {
    const sansPolar = TOUS.filter((c) => c !== "polar");
    expect(choisirPrestataire(entree({ achat: kits, prestatairesActifs: sansPolar }))).toEqual({ statut: "indisponible", raison: "carte_indisponible" });
  });
  it("Produit physique + carte, K-Pay inactif : indisponible, Polar ne remplace jamais K-Pay", () => {
    const sansKpay = TOUS.filter((c) => c !== "kpay");
    for (const achat of [physique, mixte, pass]) {
      expect(choisirPrestataire(entree({ achat, prestatairesActifs: sansKpay }))).toEqual({ statut: "indisponible", raison: "carte_indisponible" });
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
    expect(choisirPrestataire(mm({ ordre: ["maishapay", "kpay", "pawapay"] }))).toEqual({ statut: "ok", prestataire: "maishapay" });
    expect(choisirPrestataire(mm({ ordre: ["kpay", "pawapay", "maishapay"], prestatairesActifs: ["maishapay", "pawapay", "kpay"] }))).toEqual({ statut: "ok", prestataire: "kpay" });
  });
  it("un Agrégateur désactivé est ignoré : le suivant du même couple est proposé", () => {
    expect(choisirPrestataire(mm({ prestatairesActifs: ["kpay", "maishapay", "polar"] }))).toEqual({ statut: "ok", prestataire: "kpay" });
  });
  it("repli : l'Agrégateur dont une Tentative a échoué côté Prestataire est exclu, le suivant du même couple passe", () => {
    expect(choisirPrestataire(mm({ exclus: ["pawapay"] }))).toEqual({ statut: "ok", prestataire: "kpay" });
    expect(choisirPrestataire(mm({ exclus: ["pawapay", "kpay"] }))).toEqual({ statut: "ok", prestataire: "maishapay" });
  });
  it("tous les Agrégateurs du couple exclus : indisponible, aucun Prestataire inventé", () => {
    expect(choisirPrestataire(mm({ exclus: ["pawapay", "kpay", "maishapay"] }))).toEqual({ statut: "indisponible", raison: "mobile_money_indisponible" });
  });
  it("un Agrégateur qui ne couvre pas le couple est sauté", () => {
    expect(choisirPrestataire(mm({ operateur: "TEST_op_b" }))).toEqual({ statut: "ok", prestataire: "kpay" });
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
