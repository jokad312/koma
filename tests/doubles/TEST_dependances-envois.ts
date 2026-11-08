import { vi } from "vitest";
import type { AutorisationCommerciale, DependancesEnvois, EnvoiReserve, ResultatRendu } from "@/modules/envois/types";

// Faux Resend et fausse base de test (règle 13 : tests uniquement, jamais importé par src/).
type Reglages = {
  envois?: EnvoiReserve[];
  erreurReservation?: string | null;
  rendu?: (envoi: EnvoiReserve) => ResultatRendu;
  autorisation?: (envoiId: string) => AutorisationCommerciale;
  // Réponse du faux prestataire par envoi (par défaut : succès avec un identifiant TEST_resend_<id>).
  envoyer?: (envoiId: string) => { erreur: string | null; idPrestataire: string | null } | "exception";
  erreurMarquage?: boolean;
};

export const TEST_ENVOI = (id: string, modele: string = "kit_ouvert"): EnvoiReserve => ({
  id,
  modele,
  compteId: "TEST_compte",
  langue: "fr",
  donnees: { commande_id: "TEST_commande" },
  tentatives: 1,
});

export function creerTestDependancesEnvois(r: Reglages = {}) {
  const appels = {
    envoyes: [] as { envoiId: string; destinataire: string; sujet: string }[],
    marquesEnvoyes: [] as { id: string; idPrestataire: string }[],
    echecs: [] as { id: string; erreur: string }[],
    ignores: [] as { id: string; raison: string }[],
  };
  const deps: DependancesEnvois = {
    reserverLot: vi.fn(async () => ({ erreur: r.erreurReservation ?? null, envois: r.envois ?? [] })),
    rendre: vi.fn(
      async (envoi) =>
        r.rendu?.(envoi) ?? {
          statut: "pret" as const,
          destinataire: "TEST_destinataire@example.invalid",
          message: { sujet: "TEST_sujet", html: "<p>TEST</p>", texte: "TEST" },
        },
    ),
    envoyer: vi.fn(async ({ envoiId, destinataire, message }) => {
      appels.envoyes.push({ envoiId, destinataire, sujet: message.sujet });
      const reponse = r.envoyer?.(envoiId) ?? { erreur: null, idPrestataire: `TEST_resend_${envoiId}` };
      if (reponse === "exception") throw new Error("boum TEST");
      return reponse;
    }),
    marquerEnvoye: vi.fn(async (id, idPrestataire) => {
      appels.marquesEnvoyes.push({ id, idPrestataire });
      return { erreur: r.erreurMarquage ? "TEST_panne_base" : null };
    }),
    marquerEchec: vi.fn(async (id, erreur) => {
      appels.echecs.push({ id, erreur });
      return { erreur: r.erreurMarquage ? "TEST_panne_base" : null };
    }),
    autorisationCommerciale: vi.fn(async (envoiId: string) => r.autorisation?.(envoiId) ?? { autorise: true as const }),
    ignorer: vi.fn(async (id, raison) => {
      appels.ignores.push({ id, raison });
      return { erreur: r.erreurMarquage ? "TEST_panne_base" : null };
    }),
  };
  return { deps, appels };
}
