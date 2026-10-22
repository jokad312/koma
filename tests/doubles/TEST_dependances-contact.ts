import { vi } from "vitest";
import type { DependancesContact } from "@/modules/contact/types";

// Faux serveur de test (règle 13 : tests uniquement, jamais importé par src/).
type Reglages = {
  empreinte?: string | null;
  autorise?: boolean;
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
    empreinteClient: vi.fn(async () => (r.empreinte === undefined ? "TEST_empreinte" : r.empreinte)),
    consommerEssai: vi.fn(async (args) => {
      appels.ordre.push("limite");
      appels.essais.push(args);
      return { erreur: r.erreurLimite ?? null, autorise: r.autorise ?? true };
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
