import type { AuteurCompte } from "@/lib/auth/auteur";
import { correctionAgeSchema, entreeReglageSchema, idMessageSchema, nomSiteSchema, numeroWhatsappSchema } from "./schemas";
import type { CorrectionAge, EntreeReglage } from "./schemas";
import type { CleReglage, CodeErreurAdmin, DependancesAdmin, ResultatAdmin } from "./types";

// Seule la cause est journalisée : le code KS_, jamais une valeur ni un identifiant de Compte.
function journaliser(contexte: string, erreur: unknown) {
  const brut = erreur instanceof Error ? erreur.message : typeof erreur === "string" ? erreur : "";
  const code = /KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue";
  console.error(`[admin] ${contexte} : ${code}`);
}

// Erreur de la base ou du droit : code d'interface sans donnée personnelle.
function codeDepuisBase(message: string, parDefaut: CodeErreurAdmin): CodeErreurAdmin {
  if (message.includes("KS_DROIT_REFUSE") || message.includes("KS_AUTEUR_MANQUANT")) return "non_autorise";
  return parDefaut;
}

async function verifierDroit(deps: DependancesAdmin, droit: Parameters<DependancesAdmin["exigerDroit"]>[0]): Promise<{ auteur: AuteurCompte } | { erreur: CodeErreurAdmin }> {
  try {
    return { auteur: (await deps.exigerDroit(droit)).auteur };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    journaliser("droit", code);
    return { erreur: code === "KS_VERIFICATION_IMPOSSIBLE" ? "generique" : "non_autorise" };
  }
}

// Valeur normalisée que la base enregistrera (la base revalide : AD-13). Invalide : erreur de champ.
function normaliser(cle: CleReglage, valeur: string): { valeur: string | null } | { erreur: CodeErreurAdmin } {
  if (cle === "nom_site") {
    const lu = nomSiteSchema.safeParse(valeur);
    return lu.success ? { valeur: lu.data } : { erreur: "nom_invalide" };
  }
  const lu = numeroWhatsappSchema.safeParse(valeur);
  return lu.success ? { valeur: lu.data } : { erreur: "numero_invalide" };
}

// Droit, validation, écriture, puis invalidation du cache : « ok » n'est renvoyé qu'après la réponse réelle de la base (règle 13).
export async function enregistrerReglage(deps: DependancesAdmin, entree: EntreeReglage): Promise<ResultatAdmin<{ valeur: string | null }>> {
  const droit = await verifierDroit(deps, "reglages.modifier");
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const lu = entreeReglageSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "generique" };
  const normalise = normaliser(lu.data.cle, lu.data.valeur);
  if ("erreur" in normalise) return { ok: false, erreur: normalise.erreur };

  try {
    const { erreur } = await deps.ecrireReglage({ auteur: droit.auteur, cle: lu.data.cle, valeur: normalise.valeur });
    if (erreur) {
      journaliser("réglage refusé", erreur);
      if (erreur.includes("KS_REGLAGE_INVALIDE")) return { ok: false, erreur: lu.data.cle === "nom_site" ? "nom_invalide" : "numero_invalide" };
      return { ok: false, erreur: codeDepuisBase(erreur, "generique") };
    }
    deps.invalider();
    return { ok: true, valeur: normalise.valeur };
  } catch (e) {
    journaliser("réglage", e);
    return { ok: false, erreur: "generique" };
  }
}

// Correction d'âge par l'admin (service seulement : aucun écran ni route au lancement).
// Sous 13 ans, la base journalise sans changer l'âge ; le service supprime alors le Compte, comme à la déclaration.
export async function corrigerAgeParAdmin(deps: DependancesAdmin, entree: CorrectionAge): Promise<ResultatAdmin<{ compteSupprime: boolean }>> {
  const droit = await verifierDroit(deps, "age.corriger");
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const lu = correctionAgeSchema.safeParse(entree);
  if (!lu.success) {
    const champ = lu.error.issues[0]?.path[0];
    return { ok: false, erreur: champ === "raison" ? "raison_manquante" : champ === "age" ? "age_invalide" : "generique" };
  }

  try {
    const { erreur, supprimer } = await deps.corrigerAge({ auteur: droit.auteur, compteId: lu.data.compteId, age: lu.data.age, raison: lu.data.raison });
    if (erreur) {
      journaliser("correction d'âge refusée", erreur);
      if (erreur.includes("KS_RAISON_MANQUANTE")) return { ok: false, erreur: "raison_manquante" };
      if (erreur.includes("KS_AGE_INVALIDE")) return { ok: false, erreur: "age_invalide" };
      if (erreur.includes("KS_AGE_NON_DECLARE")) return { ok: false, erreur: "age_non_declare" };
      return { ok: false, erreur: codeDepuisBase(erreur, "generique") };
    }
    if (!supprimer) return { ok: true, compteSupprime: false };

    const suppression = await deps.supprimerCompte(lu.data.compteId);
    if (suppression.erreur) {
      console.error("[admin] suppression d'un Compte de moins de 13 ans impossible");
      return { ok: false, erreur: "suppression_echouee" };
    }
    return { ok: true, compteSupprime: true };
  } catch (e) {
    journaliser("correction d'âge", e);
    return { ok: false, erreur: "generique" };
  }
}

// Marque un message de contact comme traité : droit, rpc (journalisée avec l'auteur), succès seulement après la réponse de la base.
export async function marquerMessageTraite(deps: DependancesAdmin, id: string): Promise<ResultatAdmin> {
  const droit = await verifierDroit(deps, "messages.traiter");
  if ("erreur" in droit) return { ok: false, erreur: droit.erreur };

  const lu = idMessageSchema.safeParse(id);
  if (!lu.success) return { ok: false, erreur: "generique" };

  try {
    const { erreur } = await deps.marquerMessageTraite({ auteur: droit.auteur, id: lu.data });
    if (erreur) {
      journaliser("message non marqué", erreur);
      if (erreur.includes("KS_MESSAGE_INTROUVABLE")) return { ok: false, erreur: "message_introuvable" };
      return { ok: false, erreur: codeDepuisBase(erreur, "generique") };
    }
    return { ok: true };
  } catch (e) {
    journaliser("message", e);
    return { ok: false, erreur: "generique" };
  }
}
