import { vi } from "vitest";
import type { DependancesAdmin } from "@/modules/admin/types";

// Faux serveur de test (règle 13 : tests uniquement, jamais importé par src/).
export const TEST_ADMIN_ID = "TEST_admin-0001";

// Même forme que DroitRefuseError (src/lib/auth/droits.ts, server-only) : le service ne lit que le code.
class TEST_DroitRefuse extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type Reglages = {
  droit?: "KS_NON_CONNECTE" | "KS_DROIT_REFUSE" | "KS_VERIFICATION_IMPOSSIBLE" | null;
  erreurEcriture?: string | null;
  erreurAge?: string | null;
  supprimer?: boolean;
  suppressionEchoue?: boolean;
};

export function creerTestDependancesAdmin(r: Reglages = {}) {
  const appels = {
    ordre: [] as string[],
    droits: [] as string[],
    reglages: [] as unknown[],
    ages: [] as unknown[],
    suppressions: [] as string[],
  };
  const deps: DependancesAdmin = {
    exigerDroit: vi.fn(async (droit) => {
      appels.ordre.push("droit");
      appels.droits.push(droit);
      if (r.droit) throw new TEST_DroitRefuse(r.droit);
      return { auteur: { type: "compte" as const, id: TEST_ADMIN_ID, role: "admin" as const } };
    }),
    ecrireReglage: vi.fn(async (args) => {
      appels.ordre.push("ecriture");
      appels.reglages.push(args);
      return { erreur: r.erreurEcriture ?? null };
    }),
    invalider: vi.fn(() => {
      appels.ordre.push("invalidation");
    }),
    corrigerAge: vi.fn(async (args) => {
      appels.ordre.push("age");
      appels.ages.push(args);
      return { erreur: r.erreurAge ?? null, supprimer: r.supprimer ?? false };
    }),
    supprimerCompte: vi.fn(async (compteId) => {
      appels.ordre.push("suppression");
      appels.suppressions.push(compteId);
      return { erreur: r.suppressionEchoue ?? false };
    }),
  };
  return { deps, appels };
}
