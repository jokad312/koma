import { AUTEUR_VISITEUR } from "@/lib/auth/auteur";
import { emailSchema, langueContactSchema, messageSchema, nomSchema } from "./schemas";
import type { EntreeContact } from "./schemas";
import type { ChampContact, CodeChampContact, DependancesContact, ResultatContact } from "./types";

// Fenêtre fixe d'une heure pour les deux limites.
const FENETRE_CONTACT_SECONDES = 3600;

// Par adresse IP : large, car en RDC les opérateurs mobiles (CGNAT) et les cybercafés mettent beaucoup de personnes
// différentes derrière la même adresse ; une limite serrée bloquerait des visiteurs honnêtes. Sans adresse : un seau commun.
export const LIMITE_CONTACT_PAR_IP_PAR_HEURE = 30;

// Par adresse email saisie (normalisée : espaces retirés, minuscules) : c'est elle qui freine le harcèlement ou l'envoi
// en boucle, sans pénaliser les autres personnes qui partagent la même IP.
export const LIMITE_CONTACT_PAR_EMAIL_PAR_HEURE = 3;

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
    // Ordre : l'email d'abord (limite la plus serrée), puis l'IP. Un email déjà à sa limite ne consomme donc pas l'essai de
    // l'IP, qui reste disponible pour les autres personnes derrière la même adresse. L'inverse n'est pas évité : si l'IP est
    // pleine, l'essai de l'email est déjà consommé (consommer_essai compte et décide en une seule opération atomique).
    const essaiEmail = await deps.consommerEssai({
      cle: `contact:email:${deps.empreinteValeur(email.data.trim().toLowerCase())}`,
      fenetreSecondes: FENETRE_CONTACT_SECONDES,
      maximum: LIMITE_CONTACT_PAR_EMAIL_PAR_HEURE,
    });
    if (essaiEmail.erreur) {
      journaliser("limite email", essaiEmail.erreur);
      return ECHEC_GENERIQUE;
    }
    if (!essaiEmail.autorise) return { ok: false, erreur: "trop_d_essais", champs: {} };

    const empreinte = await deps.empreinteClient();
    const essaiIp = await deps.consommerEssai({
      cle: `contact:${empreinte ?? "commun"}`,
      fenetreSecondes: FENETRE_CONTACT_SECONDES,
      maximum: LIMITE_CONTACT_PAR_IP_PAR_HEURE,
    });
    if (essaiIp.erreur) {
      journaliser("limite ip", essaiIp.erreur);
      return ECHEC_GENERIQUE;
    }
    if (!essaiIp.autorise) return { ok: false, erreur: "trop_d_essais", champs: {} };

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
