// Codes d'erreur renvoyés par les actions : le texte vient de messages/*.json, côté interface.
export type CodeErreur =
  | "email_invalide"
  | "limite"
  | "envoi"
  | "code_format"
  | "code_faux"
  | "code_expire"
  | "age_invalide"
  | "moins_13"
  | "suppression_echouee"
  | "non_connecte"
  | "generique";

export type Resultat<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreur };

export type EtapeApresCode = "age" | "termine";

export type ErreurAuth = { code?: string; status?: number; name?: string } | null;

// Ce que le service attend de Supabase : en production, les vrais clients ; en test, des faux nommés TEST_.
export type DependancesComptes = {
  auth: {
    signInWithOtp(args: {
      email: string;
      options: { shouldCreateUser: boolean; data: { langue: string } };
    }): Promise<{ error: ErreurAuth }>;
    verifyOtp(args: { email: string; token: string; type: "email" }): Promise<{
      data: { user: { id: string } | null; session: { user: { id: string } } | null };
      error: ErreurAuth;
    }>;
    getClaims(): Promise<{ data: { claims: { sub?: string } } | null; error: ErreurAuth }>;
    signOut(options?: { scope: "local" }): Promise<{ error: ErreurAuth }>;
  };
  compteComplet(compteId: string): Promise<{ complet: boolean } | { erreur: true }>;
  declarerAge(args: { auteur: object; compteId: string; age: number }): Promise<{ erreur: string | null }>;
  supprimerCompte(compteId: string): Promise<{ erreur: boolean }>;
  maintenant: () => number;
};
