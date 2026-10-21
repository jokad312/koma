"use server";

import { redirect } from "next/navigation";
import { creerClientService } from "@/lib/supabase/service";
import { creerClientSession } from "@/lib/supabase/session";
import { langueSchema } from "./schemas";
import type { DeclarationAge, DemandeCode, VerificationCode } from "./schemas";
import * as service from "./service";
import type { CodeErreur, DependancesComptes } from "./types";

async function dependances(): Promise<DependancesComptes> {
  const session = await creerClientSession();
  const admin = creerClientService();
  return {
    auth: session.auth as unknown as DependancesComptes["auth"],
    compteComplet: async (compteId) => {
      const { data, error } = await admin.rpc("compte_complet", { p_compte: compteId });
      return error ? { erreur: true } : { complet: data === true };
    },
    declarerAge: async ({ auteur, compteId, age }) => {
      const { error } = await admin.rpc("declarer_age", { p_auteur: auteur as never, p_compte: compteId, p_age: age });
      return { erreur: error ? error.message : null };
    },
    supprimerCompte: async (compteId) => {
      const { error } = await admin.auth.admin.deleteUser(compteId);
      return { erreur: error !== null };
    },
    maintenant: () => Date.now(),
  };
}

export async function demanderCode(entree: DemandeCode) {
  return service.demanderCode(await dependances(), entree);
}

// Résultat du premier envoi, rendu par la page : l'adresse revient aussi en cas d'erreur pour remplir de nouveau le champ.
export type EtatEnvoi = { ok: true; email: string; envoyeLe: number } | { ok: false; erreur: CodeErreur; email: string };

// Premier envoi du code, appelé par le formulaire lui-même (<form action>) : il marche avant l'hydratation de React, la saisie
// partant avec le formulaire. Le moment d'envoi n'est écrit qu'après la réponse réelle de Supabase (règle 13).
export async function demanderCodeParFormulaire(_etat: EtatEnvoi | null, formData: FormData): Promise<EtatEnvoi> {
  const email = String(formData.get("email") ?? "");
  const langue = langueSchema.catch("fr").parse(formData.get("langue"));
  const resultat = await service.demanderCode(await dependances(), { email, langue });
  if (!resultat.ok) return { ok: false, erreur: resultat.erreur, email };
  return { ok: true, email: resultat.email, envoyeLe: Date.now() };
}

export async function verifierCode(entree: VerificationCode) {
  return service.verifierCode(await dependances(), entree);
}

export async function declarerAge(entree: DeclarationAge) {
  return service.declarerAge(await dependances(), entree);
}

export type EtatDeconnexion = { erreur: boolean };

// Ferme la session puis ramène à l'accueil de la langue ; en cas d'échec, l'interface affiche un message.
export async function deconnecter(_etat: EtatDeconnexion, formData: FormData): Promise<EtatDeconnexion> {
  const langue = langueSchema.catch("fr").parse(formData.get("langue"));
  const resultat = await service.fermerSession(await dependances());
  if (!resultat.ok) return { erreur: true };
  redirect(`/${langue}`);
}
