import { z } from "zod";
import { CODES_PRESTATAIRE, type CodePrestataire } from "./types";

// Couverture des Agrégateurs (story 5.1, règle 9, Q-1) : les couples pays-opérateur sont saisis par Jonathan, avec leur source, d'après la
// documentation officielle et les contrats de chaque Agrégateur. Aucun pays ni aucun opérateur n'est écrit dans le code ni dans une migration.

export type EtatCouple = "a_verifier" | "confirme";
export type CoupleCouverture = { id: string; prestataire: CodePrestataire; pays: string; operateur: string; source: string; etat: EtatCouple };

export type ErreurCouverture =
  | "non_autorise"
  | "source_manquante"
  | "source_invalide"
  | "pays_invalide"
  | "operateur_invalide"
  | "agregateur_invalide"
  | "couple_existant"
  | "introuvable"
  | "generique";

export type ResultatCouverture = { ok: true } | { ok: false; erreur: ErreurCouverture };

export type DependancesCouverture = {
  exigerDroit: () => Promise<{ auteur: unknown }>;
  ajouter: (auteur: unknown, c: { prestataire: CodePrestataire; pays: string; operateur: string; source: string }) => Promise<{ erreur: string | null }>;
  confirmer: (auteur: unknown, id: string) => Promise<{ erreur: string | null }>;
  retirer: (auteur: unknown, id: string) => Promise<{ erreur: string | null }>;
};

const AGREGATEURS = CODES_PRESTATAIRE.filter((c) => c !== "polar");
const idSchema = z.uuid();

// Un champ à la fois : la première erreur est celle que la page relie au champ concerné (source d'abord : elle est obligatoire).
export function validerCouple(entree: { prestataire: string; pays: string; operateur: string; source: string }):
  | { ok: true; couple: { prestataire: CodePrestataire; pays: string; operateur: string; source: string } }
  | { ok: false; erreur: ErreurCouverture } {
  const source = entree.source.trim();
  if (source.length === 0) return { ok: false, erreur: "source_manquante" };
  if (source.length < 3 || source.length > 300) return { ok: false, erreur: "source_invalide" };
  const pays = entree.pays.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(pays)) return { ok: false, erreur: "pays_invalide" };
  const operateur = entree.operateur.trim();
  if (operateur.length < 1 || operateur.length > 40) return { ok: false, erreur: "operateur_invalide" };
  if (!(AGREGATEURS as readonly string[]).includes(entree.prestataire)) return { ok: false, erreur: "agregateur_invalide" };
  return { ok: true, couple: { prestataire: entree.prestataire as CodePrestataire, pays, operateur, source } };
}

function erreurBase(erreur: string): ErreurCouverture {
  const table: Array<[string, ErreurCouverture]> = [
    ["KS_DROIT_REFUSE", "non_autorise"],
    ["KS_AUTEUR_MANQUANT", "non_autorise"],
    ["KS_SOURCE_MANQUANTE", "source_manquante"],
    ["KS_SOURCE_INVALIDE", "source_invalide"],
    ["KS_PAYS_INVALIDE", "pays_invalide"],
    ["KS_OPERATEUR_INVALIDE", "operateur_invalide"],
    ["KS_AGREGATEUR_INVALIDE", "agregateur_invalide"],
    ["KS_COUPLE_EXISTANT", "couple_existant"],
    ["KS_COUVERTURE_INTROUVABLE", "introuvable"],
  ];
  return table.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

async function autoriser(deps: DependancesCouverture): Promise<{ auteur: unknown } | null> {
  try {
    return await deps.exigerDroit();
  } catch {
    return null;
  }
}

export async function ajouterCouple(deps: DependancesCouverture, entree: { prestataire: string; pays: string; operateur: string; source: string }): Promise<ResultatCouverture> {
  const valide = validerCouple(entree);
  if (!valide.ok) return valide;
  const droit = await autoriser(deps);
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.ajouter(droit.auteur, valide.couple);
    return erreur ? { ok: false, erreur: erreurBase(erreur) } : { ok: true };
  } catch {
    console.error("[paiement] ajout d'un couple de couverture impossible");
    return { ok: false, erreur: "generique" };
  }
}

async function agirSurCouple(deps: DependancesCouverture, id: string, action: "confirmer" | "retirer"): Promise<ResultatCouverture> {
  if (!idSchema.safeParse(id).success) return { ok: false, erreur: "introuvable" };
  const droit = await autoriser(deps);
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps[action](droit.auteur, id);
    return erreur ? { ok: false, erreur: erreurBase(erreur) } : { ok: true };
  } catch {
    console.error("[paiement] changement d'un couple de couverture impossible");
    return { ok: false, erreur: "generique" };
  }
}

export const confirmerCouple = (deps: DependancesCouverture, id: string) => agirSurCouple(deps, id, "confirmer");
export const retirerCouple = (deps: DependancesCouverture, id: string) => agirSurCouple(deps, id, "retirer");

// Couples utilisables pour le paiement : confirmés seulement (le service y ajoute « Agrégateur actif »).
export function couplesConfirmes(couples: readonly CoupleCouverture[]): Array<{ prestataire: CodePrestataire; pays: string; operateur: string }> {
  return couples.filter((c) => c.etat === "confirme").map((c) => ({ prestataire: c.prestataire, pays: c.pays, operateur: c.operateur }));
}
