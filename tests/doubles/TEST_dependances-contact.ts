import { vi } from "vitest";
import type { DependancesContact } from "@/modules/contact/types";

// Faux serveur de test (règle 13 : tests uniquement, jamais importé par src/).
type Reglages = {
  empreinte?: string | null;
  autorise?: boolean;
  // Refuse seulement l'essai dont la clé commence par ce préfixe (ex. "contact:email:").
  refuserPrefixe?: string;
  erreurLimite?: string | null;
  erreurEcriture?: string | null;
  exceptionEcriture?: boolean;
};

export function creerTestDependancesContact(r: Reglages = {}) {
  const appels = {
    ordre: [] as string[],
    essais: [] as { cle: string; fenetreSecondes: number; maximum: number }[],
    messages: [] as unknown[],
  };
  const deps: DependancesContact = {
    empreinteValeur: vi.fn((valeur: string) => `TEST_hache(${valeur})`),
    empreinteClient: vi.fn(async () => (r.empreinte === undefined ? "TEST_empreinte" : r.empreinte)),
    consommerEssai: vi.fn(async (args) => {
      appels.ordre.push("limite");
      appels.essais.push(args);
      const refuse = r.refuserPrefixe !== undefined && args.cle.startsWith(r.refuserPrefixe);
      return { erreur: r.erreurLimite ?? null, autorise: refuse ? false : (r.autorise ?? true) };
    }),
    enregistrerMessage: vi.fn(async (args) => {
      appels.ordre.push("ecriture");
      appels.messages.push(args);
      if (r.exceptionEcriture) throw new Error("boum TEST");
      return { erreur: r.erreurEcriture ?? null };
    }),
  };
  return { deps, appels };
}
