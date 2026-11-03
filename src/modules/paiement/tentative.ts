import { z } from "zod";
import { choisirPrestataire } from "./aiguillage";
import type { Achat, CodePrestataire, Couverture, MoyenPaiement, Prestataire, PrestatairePaiement } from "./types";

// Lancement d'une Tentative de paiement (story 5.2, AD-4, AD-6, AD-22). Le navigateur n'envoie que son choix (moyen, pays, opérateur, numéro) :
// le Prestataire, les Familles, le montant et la référence sont décidés et relus par le serveur. Rien n'est jamais simulé : sans adaptateur
// branché, aucun Prestataire n'est actif et aucune Tentative ne peut partir.

// Limite des lancements (AD-22) : 10 par fenêtre de 10 minutes et par Compte. Valeur de départ de la story, réglable ici.
export const FENETRE_TENTATIVES_SECONDES = 600;
export const MAXIMUM_TENTATIVES = 10;

export type ErreurTentative =
  | "non_connecte"
  | "limite"
  | "entree_invalide"
  | "telephone_invalide"
  | "nom_payeur_invalide"
  | "reseau_carte_invalide"
  | "pays_operateur_requis"
  | "commande_introuvable"
  | "non_payable"
  | "tentative_en_cours"
  | "compte_incomplet"
  | "indisponible"
  | "refuse"
  | "generique";

export type ResultatTentative = { ok: true; redirection: string | null } | { ok: false; erreur: ErreurTentative };

export type DependancesTentative = {
  compteId: () => Promise<string | null>;
  // Vrai si l'essai est permis (consommer_essai).
  limiter: (cle: string, fenetreSecondes: number, maximum: number) => Promise<boolean>;
  // Commande du Compte par son numéro, avec ses Familles lues en base (règle 11) ; null si elle n'est pas à ce Compte.
  commande: (compteId: string, numero: string) => Promise<{ id: string; achat: Achat; contact: { email: string | null; nom: string | null } } | null>;
  prestataires: () => Promise<Prestataire[]>;
  couverture: () => Promise<Couverture>;
  // Agrégateurs dont une Tentative de cette Commande a fini en échec côté Prestataire.
  exclus: (commandeId: string) => Promise<CodePrestataire[]>;
  adaptateursBranches: ReadonlySet<CodePrestataire>;
  adaptateur: (code: CodePrestataire) => PrestatairePaiement | null;
  demarrer: (a: {
    compteId: string;
    numero: string;
    prestataire: CodePrestataire;
    moyen: MoyenPaiement;
    pays: string | null;
    operateur: string | null;
    referenceInterne: string;
    telephoneMasque: string | null;
  }) => Promise<{ tentativeId: string; montantAttenduCents: number } | { erreur: string }>;
  enregistrerInitiation: (tentativeId: string, referenceTransaction: string) => Promise<{ erreur: string | null }>;
  echouer: (tentativeId: string, cause: "client" | "prestataire") => Promise<void>;
  referenceInterne: (numero: string) => string;
  adresseRetour: (prestataire: CodePrestataire, numero: string) => string;
  adresseNotification: (prestataire: CodePrestataire) => string;
};

const entreeSchema = z.object({
  numero: z.string().regex(/^KS-[0-9]{4}-[0-9]{6,}$/),
  moyen: z.enum(["mobile_money", "carte"]),
  pays: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).nullable().optional(),
  operateur: z.string().trim().min(1).max(40).nullable().optional(),
  telephone: z.string().nullable().optional(),
  // Paiement par carte chez MaishaPay seulement : réseau choisi et nom du payeur (le téléphone est le champ commun ci-dessus).
  reseauCarte: z.string().nullable().optional(),
  nomPayeur: z.string().nullable().optional(),
});

const RESEAUX_CARTE = ["VISA", "MASTERCARD"] as const;
// Prestataires qui exigent le nom et le téléphone du payeur pour la carte (documentation de leur API carte) : les données ne sont demandées et
// transmises que pour eux, jamais pour un autre Prestataire ni pour le mobile money (nom).
const CARTE_AVEC_IDENTITE: readonly CodePrestataire[] = ["maishapay"];

const TELEPHONE = /^\+[0-9]{8,15}$/;

// « +243812345678 » devient « +243•••••678 » : le numéro en clair n'est jamais conservé.
export function masquerTelephone(telephone: string): string {
  const chiffres = telephone.startsWith("+") ? telephone.slice(1) : telephone;
  const debut = `+${chiffres.slice(0, 3)}`;
  const fin = chiffres.slice(-3);
  return `${debut}${"•".repeat(Math.max(chiffres.length - 6, 3))}${fin}`;
}

function erreurBase(erreur: string): ErreurTentative {
  const table: Array<[string, ErreurTentative]> = [
    ["KS_COMPTE_INCOMPLET", "compte_incomplet"],
    ["KS_COMMANDE_INTROUVABLE", "commande_introuvable"],
    ["KS_COMMANDE_NON_PAYABLE", "non_payable"],
    ["KS_TENTATIVE_EN_COURS", "tentative_en_cours"],
    ["KS_PRESTATAIRE_INACTIF", "indisponible"],
    ["KS_MOYEN_INVALIDE", "indisponible"],
    ["KS_COUVERTURE_ABSENTE", "indisponible"],
  ];
  return table.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

export async function demarrerTentative(deps: DependancesTentative, brut: unknown): Promise<ResultatTentative> {
  try {
    const compteId = await deps.compteId();
    if (!compteId) return { ok: false, erreur: "non_connecte" };
    const lu = entreeSchema.safeParse(brut);
    if (!lu.success) return { ok: false, erreur: "entree_invalide" };
    const entree = lu.data;

    let telephoneMasque: string | null = null;
    let telephone: string | null = null;
    if (entree.moyen === "mobile_money") {
      if (!entree.pays || !entree.operateur) return { ok: false, erreur: "pays_operateur_requis" };
      telephone = (entree.telephone ?? "").replace(/[\s-]/g, "");
      if (!TELEPHONE.test(telephone)) return { ok: false, erreur: "telephone_invalide" };
      telephoneMasque = masquerTelephone(telephone);
    }

    // Limite des lancements (AD-22), avant tout travail : un essai refusé est compté aussi.
    if (!(await deps.limiter(`tentative:${compteId}`, FENETRE_TENTATIVES_SECONDES, MAXIMUM_TENTATIVES))) return { ok: false, erreur: "limite" };

    const commande = await deps.commande(compteId, entree.numero);
    if (!commande) return { ok: false, erreur: "commande_introuvable" };

    // Le serveur choisit le Prestataire (aiguilleur pur) : jamais le navigateur. Un Prestataire sans adaptateur branché n'est jamais retenu.
    const [prestataires, couverture, exclus] = await Promise.all([deps.prestataires(), deps.couverture(), deps.exclus(commande.id)]);
    const actifs = prestataires.filter((p) => p.actif && deps.adaptateursBranches.has(p.code)).map((p) => p.code);
    const ordre = prestataires
      .filter((p) => p.type === "agregateur" && p.ordre !== null)
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map((p) => p.code);
    const choix = choisirPrestataire({
      achat: commande.achat,
      moyen: entree.moyen,
      pays: entree.pays ?? null,
      operateur: entree.operateur ?? null,
      prestatairesActifs: actifs,
      couverture,
      ordre,
      exclus,
    });
    if (choix.statut !== "ok") return { ok: false, erreur: "indisponible" };

    const adaptateur = deps.adaptateur(choix.prestataire);
    if (!adaptateur) return { ok: false, erreur: "indisponible" };

    // Carte chez un Prestataire qui exige l'identité du payeur : validation côté serveur du réseau, du nom et du téléphone (jamais le navigateur).
    let reseauCarte: (typeof RESEAUX_CARTE)[number] | null = null;
    let nomPayeur: string | null = null;
    if (entree.moyen === "carte" && CARTE_AVEC_IDENTITE.includes(choix.prestataire)) {
      reseauCarte = RESEAUX_CARTE.find((r) => r === (entree.reseauCarte ?? "").toUpperCase()) ?? null;
      if (!reseauCarte) return { ok: false, erreur: "reseau_carte_invalide" };
      nomPayeur = (entree.nomPayeur ?? "").replace(/\s+/g, " ").trim();
      if (nomPayeur.length < 2 || nomPayeur.length > 100 || /[<>\p{Cc}]/u.test(nomPayeur)) return { ok: false, erreur: "nom_payeur_invalide" };
      telephone = (entree.telephone ?? "").replace(/[\s-]/g, "");
      if (!TELEPHONE.test(telephone)) return { ok: false, erreur: "telephone_invalide" };
      telephoneMasque = masquerTelephone(telephone);
    }

    const referenceInterne = deps.referenceInterne(entree.numero);
    const demarre = await deps.demarrer({
      compteId,
      numero: entree.numero,
      prestataire: choix.prestataire,
      moyen: entree.moyen,
      pays: entree.moyen === "mobile_money" ? (entree.pays ?? null) : null,
      operateur: entree.moyen === "mobile_money" ? (entree.operateur ?? null) : null,
      referenceInterne,
      telephoneMasque,
    });
    if ("erreur" in demarre) return { ok: false, erreur: erreurBase(demarre.erreur) };

    // Appel au Prestataire. Un échec de l'appel lui-même (délai, coupure) n'est PAS un échec de paiement : la Tentative reste en cours et la
    // tâche de réconciliation interroge le Prestataire (AD-28) ; seul un refus confirmé la fait échouer.
    let initiation;
    try {
      initiation = await adaptateur.initier({
        referenceInterne,
        montantAttenduCents: demarre.montantAttenduCents,
        moyen: entree.moyen,
        pays: entree.pays ?? null,
        operateur: entree.operateur ?? null,
        contact: { telephone, email: commande.contact.email, nom: nomPayeur ?? commande.contact.nom },
        reseauCarte,
        adresseRetour: deps.adresseRetour(choix.prestataire, entree.numero),
        adresseNotification: deps.adresseNotification(choix.prestataire),
      });
    } catch {
      console.error("[paiement] initiation sans réponse : la Tentative reste en cours");
      return { ok: true, redirection: null };
    }
    if (initiation.statut === "refuse") {
      await deps.echouer(demarre.tentativeId, initiation.cause);
      return { ok: false, erreur: "refuse" };
    }
    if (initiation.referenceTransaction) {
      const { erreur } = await deps.enregistrerInitiation(demarre.tentativeId, initiation.referenceTransaction);
      // Une référence déjà utilisée est refusée : la Tentative échoue côté Prestataire, jamais deux paiements pour une référence.
      if (erreur) {
        await deps.echouer(demarre.tentativeId, "prestataire");
        return { ok: false, erreur: "generique" };
      }
    }
    return { ok: true, redirection: initiation.redirection };
  } catch {
    console.error("[paiement] lancement d'une Tentative impossible");
    return { ok: false, erreur: "generique" };
  }
}
