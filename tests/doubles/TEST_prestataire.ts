import type { ComparaisonMontant, DonneesTentative, NotificationVerifiee, PrestatairePaiement, ResultatAdaptateur, ResultatInitiation } from "@/modules/paiement/types";
import type { CodePrestataire } from "@/modules/paiement/types";

// Faux Prestataire de paiement, réservé aux tests automatiques (règle 13) : jamais importé par src/ (règle de lint), jamais dans le registre
// des adaptateurs. Son comportement est scripté par le test ; il enregistre les appels reçus.
export type ScenarioPrestataireTest = {
  code: CodePrestataire;
  initiation?: ResultatInitiation | Error;
  statut?: ResultatAdaptateur;
};

export function creerPrestataireTest(scenario: ScenarioPrestataireTest): PrestatairePaiement & { appels: DonneesTentative[] } {
  const appels: DonneesTentative[] = [];
  return {
    code: scenario.code,
    appels,
    async initier(tentative: DonneesTentative): Promise<ResultatInitiation> {
      appels.push(tentative);
      const r = scenario.initiation ?? { statut: "initie", referenceTransaction: `TEST-TX-${appels.length}`, redirection: null };
      if (r instanceof Error) throw r;
      return r;
    },
    async verifierNotification(): Promise<NotificationVerifiee | null> {
      return null;
    },
    async consulterStatut(): Promise<ResultatAdaptateur> {
      return scenario.statut ?? { statut: "inconnu", referenceTransaction: null, montantRecu: null, deviseRecue: null };
    },
    comparerMontant(): ComparaisonMontant {
      return "indetermine";
    },
  };
}
