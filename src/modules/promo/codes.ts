import { z } from "zod";
import type {
  DependancesCodePromo,
  EntreeModificationCodePromo,
  ErreurCodePromo,
  ResultatCodePromo,
  ValeursCodePromo,
} from "./types";

// Code promo (story 9.1, FR-46) : le code est normalisé en majuscules (unicité sans distinction de casse), l'Affilié est
// nettoyé, les pourcentages sont bornés et limités à deux décimales, le plafond absent vaut 50. Un champ à la fois : la
// première erreur est celle que la page relie au champ concerné. Aucune utilisation n'est comptée ici (AD-29, story 9.2).

// Le test se fait sur la saisie telle quelle (avant les majuscules) : toUpperCase transformerait « ß » en « SS » ou « ſ » en « S ».
const CODE = /^[A-Za-z0-9_-]{3,24}$/;
const CONTROLE = /[\p{Cc}\p{Cs}]/u;
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
  // Longueur en points de code (comme char_length en base), sans caractère de contrôle ni retour à la ligne.
  const longueur = [...affilie].length;
  if (longueur < 1 || longueur > 120 || CONTROLE.test(affilie)) return { ok: false, erreur: "affilie_invalide" };

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

// Une Server Action est appelable avec n'importe quelle valeur : le type est vérifié à l'exécution et la première erreur
// rencontrée (dans l'ordre des champs) est rendue sous forme de résultat typé, jamais d'exception.
function texte(valeur: unknown): valeur is string {
  return typeof valeur === "string";
}

function lireValeurs(entree: unknown): { ok: true; entree: EntreeModificationCodePromo } | { ok: false; erreur: ErreurCodePromo } {
  const e = (typeof entree === "object" && entree !== null ? entree : {}) as Record<string, unknown>;
  if (!texte(e.affilie)) return { ok: false, erreur: "affilie_invalide" };
  if (!texte(e.reductionPct)) return { ok: false, erreur: "reduction_invalide" };
  if (!texte(e.commissionPct)) return { ok: false, erreur: "commission_invalide" };
  if (!texte(e.plafond)) return { ok: false, erreur: "plafond_invalide" };
  if (typeof e.actif !== "boolean") return { ok: false, erreur: "generique" };
  return { ok: true, entree: { affilie: e.affilie, reductionPct: e.reductionPct, commissionPct: e.commissionPct, plafond: e.plafond, actif: e.actif } };
}

export function validerCodePromo(entree: unknown): ValidationCodePromo {
  const e = (typeof entree === "object" && entree !== null ? entree : {}) as Record<string, unknown>;
  const saisi = texte(e.code) ? e.code.trim() : "";
  if (!CODE.test(saisi)) return { ok: false, erreur: "code_invalide" };
  const lu = lireValeurs(entree);
  if (!lu.ok) return lu;
  const valeurs = validerValeurs(lu.entree, 50);
  if (!valeurs.ok) return valeurs;
  return { ok: true, code: saisi.toUpperCase(), valeurs: valeurs.valeurs };
}

export function validerModificationCodePromo(entree: unknown): ValidationModification {
  const lu = lireValeurs(entree);
  if (!lu.ok) return lu;
  return validerValeurs(lu.entree, null);
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
    ["KS_CODE_IMMUABLE", "generique"],
  ];
  return table.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

export async function creerCodePromo(deps: DependancesCodePromo, entree: unknown): Promise<ResultatCodePromo> {
  // Le droit d'abord : sans droit, rien n'est dit sur la validité de la saisie. Une panne de vérification n'est pas un refus.
  let droit: { auteur: unknown } | null;
  try {
    droit = await deps.exigerDroit();
  } catch {
    console.error("[promo] vérification du droit impossible");
    return { ok: false, erreur: "generique" };
  }
  if (!droit) return { ok: false, erreur: "non_autorise" };
  const valide = validerCodePromo(entree);
  if (!valide.ok) return valide;
  try {
    const { erreur } = await deps.creer(droit.auteur, valide.code, valide.valeurs);
    return erreur ? { ok: false, erreur: erreurBase(erreur) } : { ok: true };
  } catch {
    console.error("[promo] création d'un code promo impossible");
    return { ok: false, erreur: "generique" };
  }
}

export async function modifierCodePromo(deps: DependancesCodePromo, id: unknown, entree: unknown): Promise<ResultatCodePromo> {
  let droit: { auteur: unknown } | null;
  try {
    droit = await deps.exigerDroit();
  } catch {
    console.error("[promo] vérification du droit impossible");
    return { ok: false, erreur: "generique" };
  }
  if (!droit) return { ok: false, erreur: "non_autorise" };
  if (typeof id !== "string" || !idSchema.safeParse(id).success) return { ok: false, erreur: "introuvable" };
  const valide = validerModificationCodePromo(entree);
  if (!valide.ok) return valide;
  try {
    const { erreur } = await deps.modifier(droit.auteur, id, valide.valeurs);
    return erreur ? { ok: false, erreur: erreurBase(erreur) } : { ok: true };
  } catch {
    console.error("[promo] modification d'un code promo impossible");
    return { ok: false, erreur: "generique" };
  }
}
