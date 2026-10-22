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
  oauth?: ErreurAuth;
  urlOauth?: string | null;
  echange?: ErreurAuth;
  erreurLangue?: string | null;
  erreurProfil?: string | null;
  // Profil absent : declarerAge répond KS_PROFIL_INTROUVABLE jusqu'à ce que assurerProfil le crée.
  profilAbsent?: boolean;
  questionsVues?: boolean | "erreur";
  erreurQuestions?: string | null;
};

export function creerTestDependances(r: Reglages = {}) {
  const appels = { suppressions: [] as string[], ages: [] as unknown[], langues: [] as unknown[], profils: [] as unknown[], ordre: [] as string[], questions: [] as unknown[], oauth: [] as unknown[], echanges: [] as string[], fermetures: 0, envois: [] as unknown[] };
  let profilAbsent = r.profilAbsent ?? false;
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
      signInWithOAuth: vi.fn(async (args) => {
        appels.oauth.push(args);
        return { data: r.oauth ? null : { url: r.urlOauth === undefined ? "https://TEST_fournisseur.invalid/autoriser" : r.urlOauth }, error: r.oauth ?? null };
      }),
      exchangeCodeForSession: vi.fn(async (code) => {
        appels.echanges.push(code);
        return { data: r.echange ? null : { user: { id: TEST_COMPTE_ID }, session: null }, error: r.echange ?? null };
      }),
      signOut: vi.fn(async () => {
        appels.fermetures += 1;
        return { error: null };
      }),
    },
    compteComplet: vi.fn(async () => {
      appels.ordre.push("complet");
      return { complet: r.complet ?? false };
    }),
    questionsVues: vi.fn(async () => (r.questionsVues === "erreur" ? { erreur: true as const } : { vues: r.questionsVues ?? false })),
    enregistrerQuestions: vi.fn(async (args) => {
      appels.questions.push(args);
      return { erreur: r.erreurQuestions ?? null };
    }),
    declarerAge: vi.fn(async (args) => {
      appels.ages.push(args);
      appels.ordre.push("age");
      if (profilAbsent) return { erreur: "KS_PROFIL_INTROUVABLE" };
      return { erreur: r.erreurAge ?? null };
    }),
    assurerProfil: vi.fn(async (args) => {
      appels.profils.push(args);
      appels.ordre.push("profil");
      if (r.erreurProfil) return { erreur: r.erreurProfil };
      profilAbsent = false;
      return { erreur: null };
    }),
    definirLangue: vi.fn(async (args) => {
      appels.langues.push(args);
      return { erreur: r.erreurLangue ?? null };
    }),
    supprimerCompte: vi.fn(async (id) => {
      appels.suppressions.push(id);
      return { erreur: r.suppressionEchoue ?? false };
    }),
    maintenant: () => r.maintenant ?? Date.now(),
  };
  return { deps, appels };
}
