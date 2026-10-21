import { vi } from "vitest";
import type { DependancesComptes, ErreurAuth } from "@/modules/comptes/types";

// Faux Supabase de test (règle 13 : tests uniquement, jamais importé par src/).
export const TEST_COMPTE_ID = "TEST_compte-0001";

type Reglages = {
  envoi?: ErreurAuth;
  verification?: ErreurAuth;
  complet?: boolean;
  erreurAge?: string | null;
  suppressionEchoue?: boolean;
  sub?: string | null;
  maintenant?: number;
};

export function creerTestDependances(r: Reglages = {}) {
  const appels = { suppressions: [] as string[], ages: [] as unknown[], fermetures: 0, envois: [] as unknown[] };
  const deps: DependancesComptes = {
    auth: {
      signInWithOtp: vi.fn(async (args) => {
        appels.envois.push(args);
        return { error: r.envoi ?? null };
      }),
      verifyOtp: vi.fn(async () => ({
        data: r.verification ? { user: null, session: null } : { user: { id: TEST_COMPTE_ID }, session: null },
        error: r.verification ?? null,
      })),
      getClaims: vi.fn(async () => ({
        data: r.sub === null ? null : { claims: { sub: r.sub ?? TEST_COMPTE_ID } },
        error: null,
      })),
      signOut: vi.fn(async () => {
        appels.fermetures += 1;
        return { error: null };
      }),
    },
    compteComplet: vi.fn(async () => ({ complet: r.complet ?? false })),
    declarerAge: vi.fn(async (args) => {
      appels.ages.push(args);
      return { erreur: r.erreurAge ?? null };
    }),
    supprimerCompte: vi.fn(async (id) => {
      appels.suppressions.push(id);
      return { erreur: r.suppressionEchoue ?? false };
    }),
    maintenant: () => r.maintenant ?? Date.now(),
  };
  return { deps, appels };
}
