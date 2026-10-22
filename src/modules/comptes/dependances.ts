import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import { creerClientSession } from "@/lib/supabase/session";
import type { DependancesComptes } from "./types";

// Les vrais clients Supabase donnés au service (en test, des faux nommés TEST_ les remplacent).
export async function dependances(): Promise<DependancesComptes> {
  const session = await creerClientSession();
  const admin = creerClientService();
  return {
    auth: session.auth as unknown as DependancesComptes["auth"],
    compteComplet: async (compteId) => {
      const { data, error } = await admin.rpc("compte_complet", { p_compte: compteId });
      return error ? { erreur: true } : { complet: data === true };
    },
    questionsVues: async (compteId) => {
      const { data, error } = await admin.rpc("questions_accueil_vues", { p_compte: compteId });
      return error ? { erreur: true } : { vues: data === true };
    },
    enregistrerQuestions: async ({ auteur, compteId, origine, preference }) => {
      const { error } = await admin.rpc("enregistrer_questions_accueil", {
        p_auteur: auteur as never,
        p_compte: compteId,
        p_origine: origine as never,
        p_preference: preference as never,
      });
      return { erreur: error ? error.message : null };
    },
    declarerAge: async ({ auteur, compteId, age }) => {
      const { error } = await admin.rpc("declarer_age", { p_auteur: auteur as never, p_compte: compteId, p_age: age });
      return { erreur: error ? error.message : null };
    },
    definirLangue: async ({ auteur, compteId, langue }) => {
      const { error } = await admin.rpc("definir_langue_profil", { p_auteur: auteur as never, p_compte: compteId, p_langue: langue });
      return { erreur: error ? error.message : null };
    },
    supprimerCompte: async (compteId) => {
      const { error } = await admin.auth.admin.deleteUser(compteId);
      return { erreur: error !== null };
    },
    maintenant: () => Date.now(),
  };
}
