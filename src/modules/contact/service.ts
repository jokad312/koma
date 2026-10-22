import { AUTEUR_VISITEUR } from "@/lib/auth/auteur";
import { emailSchema, langueContactSchema, messageSchema, nomSchema } from "./schemas";
import type { EntreeContact } from "./schemas";
import type { ChampContact, CodeChampContact, DependancesContact, ResultatContact } from "./types";

// 5 envois par heure et par empreinte d'adresse IP ; sans adresse, un seul seau commun, aussi strict.
export const LIMITE_CONTACT = { fenetreSecondes: 3600, maximum: 5 } as const;

// Seule la cause est journalisée : le code KS_, jamais une valeur saisie.
function journaliser(contexte: string, erreur: unknown) {
  const brut = typeof erreur === "string" ? erreur : erreur instanceof Error ? erreur.message : "";
  console.error(`[contact] ${contexte} : ${/KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue"}`);
}

const ECHEC_GENERIQUE: ResultatContact = { ok: false, erreur: "generique", champs: {} };

// Validation, limite, puis écriture : « ok » n'est renvoyé qu'après la réponse réelle de la base (règle 13).
export async function envoyerMessageContact(deps: DependancesContact, entree: EntreeContact): Promise<ResultatContact> {
  const champs: Partial<Record<ChampContact, CodeChampContact>> = {};
  const nom = nomSchema.safeParse(entree.nom);
  const email = emailSchema.safeParse(entree.email);
  const message = messageSchema.safeParse(entree.message);
  const langue = langueContactSchema.safeParse(entree.langue);
  if (!nom.success) champs.nom = "nom_invalide";
  if (!email.success) champs.email = "email_invalide";
  if (!message.success) champs.message = "message_invalide";
  if (!nom.success || !email.success || !message.success) return { ok: false, erreur: "champs", champs };
  if (!langue.success) return ECHEC_GENERIQUE;

  try {
    const empreinte = await deps.empreinteClient();
    const essai = await deps.consommerEssai({ cle: `contact:${empreinte ?? "commun"}`, ...LIMITE_CONTACT });
    if (essai.erreur) {
      journaliser("limite", essai.erreur);
      return ECHEC_GENERIQUE;
    }
    if (!essai.autorise) return { ok: false, erreur: "trop_d_essais", champs: {} };

    const { erreur } = await deps.enregistrerMessage({
      auteur: AUTEUR_VISITEUR,
      nom: nom.data,
      email: email.data,
      message: message.data,
      langue: langue.data,
    });
    if (erreur) {
      journaliser("enregistrement refusé", erreur);
      return ECHEC_GENERIQUE;
    }
    return { ok: true };
  } catch (e) {
    journaliser("envoi", e);
    return ECHEC_GENERIQUE;
  }
}
