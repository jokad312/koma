import { z } from "zod";
import type {
  DependancesCodePromo,
  EntreeCodePromo,
  EntreeModificationCodePromo,
  ErreurCodePromo,
  ResultatCodePromo,
  ValeursCodePromo,
} from "./types";

// Code promo (story 9.1, FR-46) : le code est normalisé en majuscules (unicité sans distinction de casse), l'Affilié est
// nettoyé, les pourcentages sont bornés et limités à deux décimales, le plafond absent vaut 50. Un champ à la fois : la
// première erreur est celle que la page relie au champ concerné. Aucune utilisation n'est comptée ici (AD-29, story 9.2).

const CODE = /^[A-Z0-9_-]{3,24}$/;
const NOMBRE = /^\d{1,3}(?:\.\d{1,2})?$/;
const idSchema = z.uuid();

export type ValidationCodePromo =
  | { ok: true; code: string; valeurs: ValeursCodePromo }
  | { ok: false; erreur: ErreurCodePromo };

export type ValidationModification = { ok: true; valeurs: ValeursCodePromo } | { ok: false; erreur: ErreurCodePromo };

// "12", "12,5" ou "12.50" : la virgule est acceptée comme séparateur décimal (saisie francophone).
function pourcentage(valeur: string): number | null {
  const brut = valeur.trim().replace(",", ".");
  if (!NOMBRE.test(brut)) return null;
  const nombre = Number(brut);
  return Number.isFinite(nombre) ? nombre : null;
}

function plafond(valeur: string, defaut: number | null): number | null {
  const brut = valeur.trim();
  if (brut === "") return defaut;
  if (!/^\d+$/.test(brut)) return null;
  const nombre = Number(brut);
  return Number.isSafeInteger(nombre) ? nombre : null;
}

function validerValeurs(entree: EntreeModificationCodePromo, plafondParDefaut: number | null): { ok: true; valeurs: ValeursCodePromo } | { ok: false; erreur: ErreurCodePromo } {
  const affilie = entree.affilie.trim();
  if (affilie.length < 1 || affilie.length > 120) return { ok: false, erreur: "affilie_invalide" };

  const reduction = pourcentage(entree.reductionPct);
  if (reduction === null || reduction <= 0 || reduction > 100) return { ok: false, erreur: "reduction_invalide" };

  const commission = pourcentage(entree.commissionPct);
  if (commission === null || commission < 0 || commission > 100) return { ok: false, erreur: "commission_invalide" };

  const valeurPlafond = plafond(entree.plafond, plafondParDefaut);
  if (valeurPlafond === null || valeurPlafond < 1 || valeurPlafond > 100000) return { ok: false, erreur: "plafond_invalide" };

  return {
    ok: true,
    valeurs: { affilie, reductionPct: reduction, commissionPct: commission, plafond: valeurPlafond, actif: entree.actif },
  };
}

export function validerCodePromo(entree: EntreeCodePromo): ValidationCodePromo {
  const code = entree.code.trim().toUpperCase();
  if (!CODE.test(code)) return { ok: false, erreur: "code_invalide" };
  const valeurs = validerValeurs(entree, 50);
  if (!valeurs.ok) return valeurs;
  return { ok: true, code, valeurs: valeurs.valeurs };
}

export function validerModificationCodePromo(entree: EntreeModificationCodePromo): ValidationModification {
  return validerValeurs(entree, null);
}

function erreurBase(erreur: string): ErreurCodePromo {
  const table: Array<[string, ErreurCodePromo]> = [
    ["KS_DROIT_REFUSE", "non_autorise"],
    ["KS_AUTEUR_MANQUANT", "non_autorise"],
    ["KS_CODE_INVALIDE", "code_invalide"],
    ["KS_CODE_EXISTANT", "code_existant"],
    ["KS_AFFILIE_INVALIDE", "affilie_invalide"],
    ["KS_REDUCTION_INVALIDE", "reduction_invalide"],
    ["KS_COMMISSION_INVALIDE", "commission_invalide"],
    ["KS_PLAFOND_INVALIDE", "plafond_invalide"],
    ["KS_CODE_PROMO_INTROUVABLE", "introuvable"],
  ];
  return table.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

async function autoriser(deps: DependancesCodePromo): Promise<{ auteur: unknown } | null> {
  try {
    return await deps.exigerDroit();
  } catch {
    return null;
  }
}

export async function creerCodePromo(deps: DependancesCodePromo, entree: EntreeCodePromo): Promise<ResultatCodePromo> {
  const valide = validerCodePromo(entree);
  if (!valide.ok) return valide;
  const droit = await autoriser(deps);
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.creer(droit.auteur, valide.code, valide.valeurs);
    return erreur ? { ok: false, erreur: erreurBase(erreur) } : { ok: true };
  } catch {
    console.error("[promo] création d'un code promo impossible");
    return { ok: false, erreur: "generique" };
  }
}

export async function modifierCodePromo(deps: DependancesCodePromo, id: string, entree: EntreeModificationCodePromo): Promise<ResultatCodePromo> {
  if (!idSchema.safeParse(id).success) return { ok: false, erreur: "introuvable" };
  const valide = validerModificationCodePromo(entree);
  if (!valide.ok) return valide;
  const droit = await autoriser(deps);
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.modifier(droit.auteur, id, valide.valeurs);
    return erreur ? { ok: false, erreur: erreurBase(erreur) } : { ok: true };
  } catch {
    console.error("[promo] modification d'un code promo impossible");
    return { ok: false, erreur: "generique" };
  }
}
