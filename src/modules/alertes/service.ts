import { AUTEUR_VISITEUR } from "@/lib/auth/auteur";
import { canalSchema, emailAlerteSchema, evenementIdSchema, langueAlerteSchema, whatsappAlerteSchema } from "./schemas";
import { VERSION_CONSENTEMENT_ALERTE } from "./types";
import type { ArgumentsInscription, ChampAlerte, CodeChampAlerte, DependancesAlertes, DependancesExportAlertes, ResultatAlerte } from "./types";

// Fenêtre fixe d'une heure (AD-22, comme le formulaire de contact).
const FENETRE_ALERTE_SECONDES = 3600;
// Par adresse IP : large, car les opérateurs mobiles et les cybercafés mettent beaucoup de personnes derrière la même adresse.
export const LIMITE_ALERTE_PAR_IP_PAR_HEURE = 30;
// Par inscrit (adresse, numéro ou Compte) : freine l'inscription en boucle d'une même personne, sans gêner les autres.
export const LIMITE_ALERTE_PAR_INSCRIT_PAR_HEURE = 5;

// Seule la cause est journalisée : le code KS_, jamais une valeur saisie.
function journaliser(contexte: string, erreur: unknown) {
  const brut = typeof erreur === "string" ? erreur : erreur instanceof Error ? erreur.message : "";
  console.error(`[alertes] ${contexte} : ${/KS_[A-Z_]+/.exec(brut)?.[0] ?? "inconnue"}`);
}

const ECHEC_GENERIQUE: ResultatAlerte = { ok: false, erreur: "generique", champs: {} };

export type EntreeAlerte = { evenementId: unknown; canal: unknown; email?: unknown; whatsapp?: unknown; consentement?: unknown; langue: unknown };

// Validation, limites, puis écriture : « ok » n'est renvoyé qu'après la réponse réelle de la base (règle 13). La réponse est la même
// que l'inscrit existe déjà ou non : rien n'est révélé sur les inscrits.
export async function inscrireAlerte(deps: DependancesAlertes, entree: EntreeAlerte): Promise<ResultatAlerte> {
  const champs: Partial<Record<ChampAlerte, CodeChampAlerte>> = {};
  const canal = canalSchema.safeParse(entree.canal);
  if (!canal.success) champs.canal = "canal_requis";
  const email = canal.success && canal.data === "email" ? emailAlerteSchema.safeParse(entree.email) : null;
  if (email && !email.success) champs.email = "email_invalide";
  const whatsapp = canal.success && canal.data === "whatsapp" ? whatsappAlerteSchema.safeParse(entree.whatsapp) : null;
  if (whatsapp && !whatsapp.success) champs.whatsapp = "whatsapp_invalide";
  // La case est obligatoire et jamais pré-cochée : seule la valeur « true » envoyée par le formulaire la coche.
  if (entree.consentement !== true) champs.consentement = "consentement_requis";
  if (Object.keys(champs).length > 0 || !canal.success) return { ok: false, erreur: "champs", champs };

  const evenementId = evenementIdSchema.safeParse(entree.evenementId);
  const langue = langueAlerteSchema.safeParse(entree.langue);
  if (!evenementId.success || !langue.success) return ECHEC_GENERIQUE;

  try {
    let auteur: ArgumentsInscription["auteur"] = AUTEUR_VISITEUR;
    let valeur: string | null = null;
    let cleInscrit: string;
    if (canal.data === "compte") {
      const compte = await deps.compte();
      if (!compte) return { ok: false, erreur: "non_connecte", champs: {} };
      auteur = compte.auteur;
      cleInscrit = `compte:${compte.compteId}`;
    } else if (email?.success) {
      valeur = email.data;
      cleInscrit = `email:${email.data}`;
    } else if (whatsapp?.success) {
      valeur = whatsapp.data;
      cleInscrit = `whatsapp:${whatsapp.data}`;
    } else {
      return ECHEC_GENERIQUE;
    }

    // L'inscrit d'abord (limite la plus serrée), puis l'adresse IP : un inscrit déjà à sa limite ne consomme pas l'essai de l'IP.
    const essaiInscrit = await deps.consommerEssai({
      cle: `alerte:inscrit:${deps.empreinteValeur(`${evenementId.data}:${cleInscrit}`)}`,
      fenetreSecondes: FENETRE_ALERTE_SECONDES,
      maximum: LIMITE_ALERTE_PAR_INSCRIT_PAR_HEURE,
    });
    if (essaiInscrit.erreur) {
      journaliser("limite inscrit", essaiInscrit.erreur);
      return ECHEC_GENERIQUE;
    }
    if (!essaiInscrit.autorise) return { ok: false, erreur: "trop_d_essais", champs: {} };

    const empreinte = await deps.empreinteClient();
    const essaiIp = await deps.consommerEssai({ cle: `alerte:${empreinte ?? "commun"}`, fenetreSecondes: FENETRE_ALERTE_SECONDES, maximum: LIMITE_ALERTE_PAR_IP_PAR_HEURE });
    if (essaiIp.erreur) {
      journaliser("limite ip", essaiIp.erreur);
      return ECHEC_GENERIQUE;
    }
    if (!essaiIp.autorise) return { ok: false, erreur: "trop_d_essais", champs: {} };

    const { erreur } = await deps.inscrire({
      auteur,
      evenementId: evenementId.data,
      canal: canal.data,
      valeur,
      langue: langue.data,
      version: VERSION_CONSENTEMENT_ALERTE[canal.data],
    });
    if (erreur) {
      journaliser("inscription refusée", erreur);
      if (erreur.includes("KS_VENTE_OUVERTE")) return { ok: false, erreur: "vente_ouverte", champs: {} };
      if (erreur.includes("KS_ALERTE_INDISPONIBLE")) return { ok: false, erreur: "indisponible", champs: {} };
      if (erreur.includes("KS_COMPTE_INCOMPLET")) return { ok: false, erreur: "compte_incomplet", champs: {} };
      if (erreur.includes("KS_EMAIL_INVALIDE")) return { ok: false, erreur: "champs", champs: { email: "email_invalide" } };
      if (erreur.includes("KS_WHATSAPP_INVALIDE")) return { ok: false, erreur: "champs", champs: { whatsapp: "whatsapp_invalide" } };
      return ECHEC_GENERIQUE;
    }
    return { ok: true };
  } catch (e) {
    // Compte incomplet : le Compte est connecté mais n'a pas déclaré son âge.
    if (e instanceof Error && e.message === "KS_COMPTE_INCOMPLET") return { ok: false, erreur: "compte_incomplet", champs: {} };
    journaliser("inscription", e);
    return ECHEC_GENERIQUE;
  }
}

// Tâche planifiée : emails des événements dont la vente vient d'ouvrir. Aucun email n'est créé ici : la base décide (planifier_alertes_evenements).
export async function planifierAlertes(deps: Pick<DependancesAlertes, "planifier">): Promise<{ ok: true; nombre: number } | { ok: false }> {
  try {
    const r = await deps.planifier();
    if (r.erreur) {
      journaliser("planification", r.erreur);
      return { ok: false };
    }
    return { ok: true, nombre: r.nombre };
  } catch (e) {
    journaliser("planification", e);
    return { ok: false };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EN_TETE_CSV_WHATSAPP = "numero_whatsapp";

export type ResultatExport = { ok: true; csv: string; nombre: number } | { ok: false; erreur: "evenement_invalide" | "non_connecte" | "non_autorise" | "introuvable" | "generique" };

// Export CSV des numéros WhatsApp d'un événement : droit « evenements.gerer » vérifié côté serveur, export journalisé par la base
// dans la même transaction que la lecture. Le fichier n'est jamais écrit sur disque : il est renvoyé au navigateur.
export async function exporterNumerosWhatsapp(deps: DependancesExportAlertes, evenementId: string): Promise<ResultatExport> {
  if (!UUID.test(evenementId)) return { ok: false, erreur: "evenement_invalide" };
  let auteur;
  try {
    ({ auteur } = await deps.exigerDroit("evenements.gerer"));
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "KS_NON_CONNECTE") return { ok: false, erreur: "non_connecte" };
    if (code === "KS_DROIT_REFUSE") return { ok: false, erreur: "non_autorise" };
    journaliser("export : droit", e);
    return { ok: false, erreur: "generique" };
  }
  try {
    const { erreur, numeros } = await deps.exporterNumeros({ auteur, evenementId });
    if (erreur) {
      journaliser("export", erreur);
      return { ok: false, erreur: erreur.includes("KS_EVENEMENT_INTROUVABLE") ? "introuvable" : erreur.includes("KS_DROIT_REFUSE") ? "non_autorise" : "generique" };
    }
    // Seuls « + » et des chiffres entrent dans la base (contrainte) : aucune cellule ne peut contenir de guillemet, de virgule ni de formule.
    const valides = numeros.filter((n) => /^\+[0-9]{8,15}$/.test(n));
    return { ok: true, csv: [EN_TETE_CSV_WHATSAPP, ...valides].join("\r\n") + "\r\n", nombre: valides.length };
  } catch (e) {
    journaliser("export", e);
    return { ok: false, erreur: "generique" };
  }
}
