import { z } from "zod";
import type { CodeErreurBenevole, DependancesBenevoles, ResultatAttribution, ResultatRetrait, StatutAttribution } from "./types";

const uuid = z.uuid();
// Mêmes bornes que la base (attribuer_acces_benevole) : adresse de 3 à 254 caractères, en minuscules.
const emailSchema = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email())
  .transform((e) => e.toLowerCase());
const STATUTS: readonly StatutAttribution[] = ["attribue", "deja", "mis_a_jour", "sans_compte"];

// Seule la cause est journalisée : le code KS_, jamais un email ni un identifiant saisi.
function journaliser(contexte: string, erreur: unknown) {
  const brut = typeof erreur === "string" ? erreur : erreur instanceof Error ? erreur.message : "";
  console.error(`[benevoles] ${contexte} : ${/KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue"}`);
}

function codeDepuisBase(erreur: string): CodeErreurBenevole {
  if (erreur.includes("KS_DROIT_REFUSE")) return "non_autorise";
  if (erreur.includes("KS_EMAIL_INVALIDE")) return "email_invalide";
  if (erreur.includes("KS_EVENEMENT_PASSE")) return "evenement_passe";
  if (erreur.includes("KS_EVENEMENT_SANS_DATE")) return "evenement_sans_date";
  return "generique";
}

async function droit(deps: DependancesBenevoles) {
  try {
    return { auteur: (await deps.exigerDroit()).auteur };
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "KS_NON_CONNECTE") return { erreur: "non_connecte" as const };
    if (code === "KS_DROIT_REFUSE") return { erreur: "non_autorise" as const };
    journaliser("droit", e);
    return { erreur: "generique" as const };
  }
}

// Donne l'accès au Scan d'un Événement à l'email saisi. « ok » n'est rendu qu'après la réponse réelle de la base (règle 13) ;
// « sans_compte » est un état normal (aucun Compte pour cet email : rien n'est créé).
export async function attribuerAcces(deps: DependancesBenevoles, entree: { evenementId: unknown; email: unknown }): Promise<ResultatAttribution> {
  const evenementId = uuid.safeParse(entree.evenementId);
  if (!evenementId.success) return { ok: false, erreur: "generique" };
  const email = emailSchema.safeParse(entree.email);
  if (!email.success) return { ok: false, erreur: "email_invalide" };
  const d = await droit(deps);
  if (!d.auteur) return { ok: false, erreur: d.erreur };
  try {
    const { erreur, statut } = await deps.attribuer({ auteur: d.auteur, evenementId: evenementId.data, email: email.data });
    if (erreur) {
      journaliser("attribution", erreur);
      return { ok: false, erreur: codeDepuisBase(erreur) };
    }
    const connu = STATUTS.find((s) => s === statut);
    if (!connu) return { ok: false, erreur: "generique" };
    return { ok: true, statut: connu };
  } catch (e) {
    journaliser("attribution exception", e);
    return { ok: false, erreur: "generique" };
  }
}

// Retire un accès de CET Événement (la base refuse un accès qui appartient à un autre).
export async function retirerAcces(deps: DependancesBenevoles, entree: { evenementId: unknown; accesId: unknown }): Promise<ResultatRetrait> {
  const evenementId = uuid.safeParse(entree.evenementId);
  const accesId = uuid.safeParse(entree.accesId);
  if (!evenementId.success || !accesId.success) return { ok: false, erreur: "generique" };
  const d = await droit(deps);
  if (!d.auteur) return { ok: false, erreur: d.erreur };
  try {
    const { erreur, retire } = await deps.retirer({ auteur: d.auteur, evenementId: evenementId.data, accesId: accesId.data });
    if (erreur) {
      journaliser("retrait", erreur);
      return { ok: false, erreur: codeDepuisBase(erreur) };
    }
    return { ok: true, retire };
  } catch (e) {
    journaliser("retrait exception", e);
    return { ok: false, erreur: "generique" };
  }
}
