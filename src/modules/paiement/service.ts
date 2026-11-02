import { z } from "zod";
import { adaptateurBranche } from "./registre";
import { choisirPrestataire } from "./aiguillage";
import { CODES_PRESTATAIRE, type Achat, type CodePrestataire, type Couverture, type MoyenPaiement, type Prestataire } from "./types";

// ---- Moyens proposés pour une Commande (Récapitulatif, story 4.5) ----

export type DependancesOptions = {
  prestataires: () => Promise<Prestataire[]>;
  // Familles et type de la Commande LUS EN BASE pour ce Compte (règle 11) ; null si la Commande n'est pas à ce Compte. Jamais le navigateur.
  achat: (commandeId: string, compteId: string) => Promise<Achat | null>;
  // Couverture pays-opérateur saisie par Jonathan (story 5.1) ; vide tant qu'elle n'existe pas.
  couverture: () => Promise<Couverture>;
  adaptateursBranches: ReadonlySet<CodePrestataire>;
};

export type OptionsPaiement = {
  carte: { disponible: true; prestataire: { code: CodePrestataire; nom: string } } | { disponible: false };
  mobileMoney: { disponible: boolean };
};

const idSchema = z.uuid();

// Ce que le serveur autorise pour cette Commande : la carte (Prestataire choisi par l'aiguilleur, jamais substitué) et le mobile money
// (seulement si un Agrégateur actif couvre au moins un couple pays-opérateur). Null : Commande inconnue ou d'un autre Compte.
export async function lireOptionsPaiement(deps: DependancesOptions, entree: { commandeId: string; compteId: string }): Promise<OptionsPaiement | null> {
  if (!idSchema.safeParse(entree.commandeId).success) return null;
  const achat = await deps.achat(entree.commandeId, entree.compteId);
  if (!achat) return null;
  const [prestataires, couverture] = await Promise.all([deps.prestataires(), deps.couverture()]);
  // Un Prestataire dont l'adaptateur n'est pas branché n'est jamais proposé, même s'il est marqué actif en base.
  const actifs = prestataires.filter((p) => p.actif && adaptateurBranche(p.code, deps.adaptateursBranches));
  const codes = actifs.map((p) => p.code);
  const ordre = prestataires
    .filter((p) => p.type === "agregateur" && p.ordre !== null)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
    .map((p) => p.code);

  const choixCarte = choisirPrestataire({ achat, moyen: "carte", pays: null, operateur: null, prestatairesActifs: codes, couverture, ordre, exclus: [] });
  const carte: OptionsPaiement["carte"] =
    choixCarte.statut === "ok"
      ? { disponible: true, prestataire: { code: choixCarte.prestataire, nom: prestataires.find((p) => p.code === choixCarte.prestataire)?.nom ?? choixCarte.prestataire } }
      : { disponible: false };

  const mobileMoney = actifs.some((p) => p.mobileMoney && p.type === "agregateur" && couverture.some((c) => c.prestataire === p.code));
  return { carte, mobileMoney: { disponible: mobileMoney } };
}

// ---- Moyens des Prestataires actifs (pied de page) ----

export type MoyensPrestataire = { code: CodePrestataire; nom: string; moyens: MoyenPaiement[] };

export function moyensActifs(prestataires: readonly Prestataire[], branches: ReadonlySet<CodePrestataire>): MoyensPrestataire[] {
  return prestataires
    .filter((p) => p.actif && adaptateurBranche(p.code, branches))
    .sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99))
    .map((p) => ({ code: p.code, nom: p.nom, moyens: [...(p.mobileMoney ? (["mobile_money"] as const) : []), ...(p.carte ? (["carte"] as const) : [])] }));
}

// ---- Administration des Prestataires (FR-21) ----

export type ErreurPrestataire = "non_autorise" | "prestataire_inconnu" | "adaptateur_absent" | "sens_invalide" | "generique";
export type ResultatPrestataire = { ok: true } | { ok: false; erreur: ErreurPrestataire };

export type DependancesAdminPaiement = {
  exigerDroit: () => Promise<{ auteur: unknown }>;
  definirActif: (auteur: unknown, code: CodePrestataire, actif: boolean) => Promise<{ erreur: string | null }>;
  deplacer: (auteur: unknown, code: CodePrestataire, sens: "monter" | "descendre") => Promise<{ erreur: string | null }>;
  invalider: () => Promise<void>;
  adaptateursBranches: ReadonlySet<CodePrestataire>;
};

const codeSchema = z.enum(CODES_PRESTATAIRE);
const sensSchema = z.enum(["monter", "descendre"]);

async function autoriser(deps: DependancesAdminPaiement): Promise<{ auteur: unknown } | null> {
  try {
    return await deps.exigerDroit();
  } catch {
    return null;
  }
}

function erreurBase(erreur: string): ErreurPrestataire {
  if (erreur.includes("KS_DROIT_REFUSE") || erreur.includes("KS_AUTEUR_MANQUANT")) return "non_autorise";
  if (erreur.includes("KS_PRESTATAIRE_INTROUVABLE")) return "prestataire_inconnu";
  if (erreur.includes("KS_SENS_INVALIDE") || erreur.includes("KS_PRESTATAIRE_SANS_ORDRE")) return "sens_invalide";
  return "generique";
}

// Activer ou désactiver : l'état affiché n'est celui du Prestataire qu'après la réponse réelle de la base (règle 13).
// Activer un Prestataire dont l'adaptateur n'est pas branché est refusé.
export async function changerEtatPrestataire(deps: DependancesAdminPaiement, entree: { code: string; actif: boolean }): Promise<ResultatPrestataire> {
  const code = codeSchema.safeParse(entree.code);
  if (!code.success || typeof entree.actif !== "boolean") return { ok: false, erreur: "prestataire_inconnu" };
  const droit = await autoriser(deps);
  if (!droit) return { ok: false, erreur: "non_autorise" };
  if (entree.actif && !adaptateurBranche(code.data, deps.adaptateursBranches)) return { ok: false, erreur: "adaptateur_absent" };
  try {
    const { erreur } = await deps.definirActif(droit.auteur, code.data, entree.actif);
    if (erreur) return { ok: false, erreur: erreurBase(erreur) };
    await deps.invalider();
    return { ok: true };
  } catch {
    console.error("[paiement] changement d'état d'un Prestataire impossible");
    return { ok: false, erreur: "generique" };
  }
}

export async function deplacerPrestataire(deps: DependancesAdminPaiement, entree: { code: string; sens: string }): Promise<ResultatPrestataire> {
  const code = codeSchema.safeParse(entree.code);
  const sens = sensSchema.safeParse(entree.sens);
  if (!code.success) return { ok: false, erreur: "prestataire_inconnu" };
  if (!sens.success) return { ok: false, erreur: "sens_invalide" };
  const droit = await autoriser(deps);
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.deplacer(droit.auteur, code.data, sens.data);
    if (erreur) return { ok: false, erreur: erreurBase(erreur) };
    await deps.invalider();
    return { ok: true };
  } catch {
    console.error("[paiement] déplacement d'un Prestataire impossible");
    return { ok: false, erreur: "generique" };
  }
}
