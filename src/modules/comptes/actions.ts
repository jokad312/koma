"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { adresseSite } from "@/lib/seo/url";
import { COOKIE_RETOUR_GOOGLE, DUREE_RETOUR_GOOGLE_S } from "./google";
import { dependances } from "./dependances";
import { langueSchema } from "./schemas";
import type { DeclarationAge, DemandeCode, QuestionsAccueil, VerificationCode } from "./schemas";
import * as service from "./service";
import type { CodeErreur } from "./types";

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

export async function enregistrerQuestionsAccueil(entree: QuestionsAccueil) {
  return service.enregistrerQuestionsAccueil(await dependances(), entree);
}

export type EtatDeconnexion = { erreur: boolean };

// Ferme la session puis ramène à l'accueil de la langue ; en cas d'échec, l'interface affiche un message.
export async function deconnecter(_etat: EtatDeconnexion, formData: FormData): Promise<EtatDeconnexion> {
  const langue = langueSchema.catch("fr").parse(formData.get("langue"));
  const resultat = await service.fermerSession(await dependances());
  if (!resultat.ok) return { erreur: true };
  redirect(`/${langue}`);
}

export type EtatGoogle = { erreur: CodeErreur } | null;

// Bouton « Continuer avec Google » (<form action>, marche avant l'hydratation). L'agent est relu côté serveur : un navigateur intégré est refusé.
// La langue et le retour validés sont gardés dans un cookie court (le retour de Google n'a pas de paramètres, l'adresse de redirection reste fixe).
export async function connecterAvecGoogle(_etat: EtatGoogle, formData: FormData): Promise<EtatGoogle> {
  const langue = langueSchema.catch("fr").parse(formData.get("langue"));
  const retour = formData.get("retour");
  const agent = (await headers()).get("user-agent");
  const resultat = await service.demarrerGoogle(
    await dependances(),
    { langue, retour: typeof retour === "string" ? retour : undefined },
    { agent, adresseSite: adresseSite() },
  );
  if (!resultat.ok) return { erreur: resultat.erreur };
  (await cookies()).set(COOKIE_RETOUR_GOOGLE, JSON.stringify({ langue: resultat.langue, retour: resultat.retour }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: DUREE_RETOUR_GOOGLE_S,
  });
  redirect(resultat.url);
}
