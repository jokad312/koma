import { z } from "zod";
import type { Droit } from "@/lib/auth/matrice-droits";
import type { AuteurCompte } from "@/lib/auth/auteur";

// Candidatures Stand vues par l'Admin (story 7.11) : liste d'un Événement et refus après coup. Les photos sont dans un bucket privé ; l'Admin ne les voit
// que par des liens signés de courte durée créés côté serveur. Rien n'est jamais publié.
export const BUCKET_CANDIDATURES_STAND = "candidatures-stand-private";
export const MOTIF_REFUS_MAX = 500;

export type EtatCandidature = "acceptee" | "payee" | "expiree" | "refusee" | "fermee";

export type CandidatureAdmin = {
  id: string;
  etat: EtatCandidature;
  email: string | null;
  typeNom: string;
  creeLe: string;
  // Échéance de paiement (candidature acceptée non payée).
  expireLe: string;
  description: string | null;
  instagram: string | null;
  // Liens signés de courte durée ; vide si les photos ont été purgées.
  photos: string[];
  photosPurgees: boolean;
  motifRefus: string | null;
  // Fermeture sur place le jour de l'Événement (sans remboursement) : motif saisi par l'Admin.
  motifFermeture: string | null;
};

// Calcul de l'état affiché : « payée » se déduit de la Commande liée, « expirée » de l'échéance (aucune tâche : calcul à la lecture).
export function etatCandidature(c: { statut: string; expireLe: string; commandeStatut: string | null; fermeeLe?: string | null }, maintenant: number): EtatCandidature {
  if (c.statut === "refusee") return "refusee";
  if (c.fermeeLe) return "fermee";
  if (c.commandeStatut === "payee" || c.commandeStatut === "offerte") return "payee";
  return Date.parse(c.expireLe) > maintenant ? "acceptee" : "expiree";
}

export type ErreurRefusCandidature = "non_autorise" | "entree_invalide" | "introuvable" | "deja_refusee" | "annulation_impossible" | "reglage_manquant" | "generique";
export type ResultatRefusCandidature = { ok: true; montantCents: number } | { ok: false; erreur: ErreurRefusCandidature };

export type DependancesRefusCandidature = {
  exigerDroit(droit: Droit): Promise<{ auteur: AuteurCompte }>;
  refuser(args: { auteur: AuteurCompte; candidatureId: string; motif: string | null }): Promise<{ erreur: string | null; montantCents: number }>;
  // Étiquette « evenements » vidée après l'écriture : les places libérées se relisent.
  invalider(): Promise<void>;
};

// Refus d'une candidature ou d'un Stand, avant ou après paiement (Admin). La base revérifie le droit d'Admin et fait tout dans une transaction :
// avant paiement le lien est annulé et la place libérée ; après paiement le Stand et ses 2 Pass sont annulés et un remboursement est ouvert
// (confirmé ensuite avec preuve, tâche « Remboursement de Pass à confirmer »). Le succès n'est annoncé qu'après la réponse réelle de la base (règle 13).
export async function refuserCandidatureStand(deps: DependancesRefusCandidature, entree: { candidatureId: unknown; motif: unknown }): Promise<ResultatRefusCandidature> {
  const id = z.string().uuid().safeParse(entree.candidatureId);
  if (!id.success || (entree.motif !== null && entree.motif !== undefined && typeof entree.motif !== "string")) return { ok: false, erreur: "entree_invalide" };
  const motif = typeof entree.motif === "string" ? entree.motif.trim() : "";
  if (motif.length > MOTIF_REFUS_MAX) return { ok: false, erreur: "entree_invalide" };
  let auteur: AuteurCompte;
  try {
    ({ auteur } = await deps.exigerDroit("evenements.gerer"));
  } catch {
    return { ok: false, erreur: "non_autorise" };
  }
  try {
    const r = await deps.refuser({ auteur, candidatureId: id.data, motif: motif === "" ? null : motif });
    if (r.erreur) {
      // Seule la cause est journalisée : jamais le motif ni l'identifiant d'un Compte.
      console.error(`[candidatures-stand] refus : ${/KS_[A-Z_]+/.exec(r.erreur)?.[0] ?? "inconnue"}`);
      if (r.erreur.includes("KS_CANDIDATURE_INTROUVABLE")) return { ok: false, erreur: "introuvable" };
      if (r.erreur.includes("KS_CANDIDATURE_REFUSEE")) return { ok: false, erreur: "deja_refusee" };
      if (r.erreur.includes("KS_ANNULATION_IMPOSSIBLE")) return { ok: false, erreur: "annulation_impossible" };
      if (r.erreur.includes("KS_REGLAGE_MANQUANT")) return { ok: false, erreur: "reglage_manquant" };
      if (r.erreur.includes("KS_MOTIF_INVALIDE")) return { ok: false, erreur: "entree_invalide" };
      if (r.erreur.includes("KS_DROIT_REFUSE") || r.erreur.includes("KS_AUTEUR_MANQUANT")) return { ok: false, erreur: "non_autorise" };
      return { ok: false, erreur: "generique" };
    }
    await deps.invalider();
    return { ok: true, montantCents: r.montantCents };
  } catch {
    console.error("[candidatures-stand] refus : exception inattendue");
    return { ok: false, erreur: "generique" };
  }
}

export type ErreurFermetureStand = "non_autorise" | "entree_invalide" | "introuvable" | "deja_refusee" | "deja_ferme" | "non_paye" | "evenement_pas_commence" | "annulation_impossible" | "generique";
export type ResultatFermetureStand = { ok: true } | { ok: false; erreur: ErreurFermetureStand };

export type DependancesFermetureStand = {
  exigerDroit(droit: Droit): Promise<{ auteur: AuteurCompte }>;
  fermer(args: { auteur: AuteurCompte; candidatureId: string; motif: string | null }): Promise<{ erreur: string | null }>;
  invalider(): Promise<void>;
};

// Fermeture sur place d'un Stand payé le jour de l'Événement (contrefaçon constatée), SANS remboursement (CGV §10, décision du 2026-11-12). Avant le début
// de l'Événement, la base refuse : il faut « Refuser » (annulation et remboursement par le circuit de la 7.9). Aucun email, aucune ligne de remboursement.
// Le succès n'est annoncé qu'après la réponse réelle de la base (règle 13).
export async function fermerStandSurPlace(deps: DependancesFermetureStand, entree: { candidatureId: unknown; motif: unknown }): Promise<ResultatFermetureStand> {
  const id = z.string().uuid().safeParse(entree.candidatureId);
  if (!id.success || (entree.motif !== null && entree.motif !== undefined && typeof entree.motif !== "string")) return { ok: false, erreur: "entree_invalide" };
  const motif = typeof entree.motif === "string" ? entree.motif.trim() : "";
  if (motif.length > MOTIF_REFUS_MAX) return { ok: false, erreur: "entree_invalide" };
  let auteur: AuteurCompte;
  try {
    ({ auteur } = await deps.exigerDroit("evenements.gerer"));
  } catch {
    return { ok: false, erreur: "non_autorise" };
  }
  try {
    const r = await deps.fermer({ auteur, candidatureId: id.data, motif: motif === "" ? null : motif });
    if (r.erreur) {
      console.error(`[candidatures-stand] fermeture : ${/KS_[A-Z_]+/.exec(r.erreur)?.[0] ?? "inconnue"}`);
      if (r.erreur.includes("KS_CANDIDATURE_INTROUVABLE")) return { ok: false, erreur: "introuvable" };
      if (r.erreur.includes("KS_CANDIDATURE_REFUSEE")) return { ok: false, erreur: "deja_refusee" };
      if (r.erreur.includes("KS_STAND_DEJA_FERME")) return { ok: false, erreur: "deja_ferme" };
      if (r.erreur.includes("KS_STAND_NON_PAYE")) return { ok: false, erreur: "non_paye" };
      if (r.erreur.includes("KS_EVENEMENT_PAS_COMMENCE")) return { ok: false, erreur: "evenement_pas_commence" };
      if (r.erreur.includes("KS_ANNULATION_IMPOSSIBLE")) return { ok: false, erreur: "annulation_impossible" };
      if (r.erreur.includes("KS_MOTIF_INVALIDE")) return { ok: false, erreur: "entree_invalide" };
      if (r.erreur.includes("KS_DROIT_REFUSE") || r.erreur.includes("KS_AUTEUR_MANQUANT")) return { ok: false, erreur: "non_autorise" };
      return { ok: false, erreur: "generique" };
    }
    await deps.invalider();
    return { ok: true };
  } catch {
    console.error("[candidatures-stand] fermeture : exception inattendue");
    return { ok: false, erreur: "generique" };
  }
}
