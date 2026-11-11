import { vi } from "vitest";
import type { DependancesAchat, RecapPassBrut } from "@/modules/evenements/achat-types";

// Faux serveur de test (règle 13 : tests uniquement, jamais importé par src/). Aucun paiement, aucune base : les réponses sont celles qu'on règle.
export const TEST_COMPTE_ACHAT = "00000000-0000-4000-8000-0000000000b1";
export const TEST_EVENEMENT = "00000000-0000-4000-8000-0000000000c1";
export const TEST_TYPE = "00000000-0000-4000-8000-0000000000d1";
export const TEST_TYPE_2 = "00000000-0000-4000-8000-0000000000d2";

class TEST_CompteRefuse extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export const TEST_RECAP: RecapPassBrut = {
  lignes: [{ type_pass_id: TEST_TYPE, nom_fr: "TEST_Pass simple", nom_en: "TEST_Simple pass", prix_cents: 1500, nombre: 2, titulaires: ["TEST_Alice", "TEST_Bob"], reduction_cents: 0 }],
  personnes: 2,
  sous_total_cents: 3000,
  reduction_cents: 0,
  code: null,
  total_cents: 3000,
};

type Reglages = {
  compte?: "KS_NON_CONNECTE" | "KS_COMPTE_INCOMPLET" | "KS_VERIFICATION_IMPOSSIBLE" | null;
  nomCompte?: string | null;
  erreurRecap?: string | null;
  erreurCommande?: string | null;
  // Réponses successives de creerCommande (la dernière se répète) : sert à simuler « total changé » puis « accepté ».
  erreursCommande?: Array<string | null>;
  recap?: RecapPassBrut;
};

export function creerTestDependancesAchat(r: Reglages = {}) {
  const appels = {
    recaps: [] as Array<Parameters<DependancesAchat["recapitulatif"]>[0]>,
    commandes: [] as Array<Parameters<DependancesAchat["creerCommande"]>[0]>,
  };
  let n = 0;
  const deps: DependancesAchat = {
    exigerCompte: vi.fn(async () => {
      if (r.compte) throw new TEST_CompteRefuse(r.compte);
      return { compteId: TEST_COMPTE_ACHAT, auteur: { type: "compte" as const, id: TEST_COMPTE_ACHAT, role: null } };
    }),
    nomDuCompte: vi.fn(async () => (r.nomCompte === undefined ? null : r.nomCompte)),
    recapitulatif: vi.fn(async (e) => {
      appels.recaps.push(e);
      return r.erreurRecap ? { erreur: r.erreurRecap } : { recap: r.recap ?? TEST_RECAP };
    }),
    creerCommande: vi.fn(async (e) => {
      appels.commandes.push(e);
      const erreur = r.erreursCommande ? (r.erreursCommande[Math.min(n++, r.erreursCommande.length - 1)] ?? null) : (r.erreurCommande ?? null);
      return erreur ? { erreur } : { numero: "KS-2099-000001", expireLe: "2099-01-01T00:00:00Z" };
    }),
  };
  return { deps, appels };
}
