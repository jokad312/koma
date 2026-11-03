import type { CodePrestataire, PrestatairePaiement, RequeteNotification, ResultatAdaptateur } from "./types";

// Socle de confirmation du paiement (story 4.8, AD-4, AD-5, AD-10 ; règles 2 et 13). Seul ce module décide quoi faire d'un résultat de Prestataire,
// et seule la fonction SQL confirmer_paiement fait passer une Commande à « payee ». Un résultat ne vient jamais du navigateur : il vient d'une
// notification vérifiée par l'adaptateur, ou d'une consultation de l'API du Prestataire (consulterStatut).

export type TentativeLue = {
  id: string;
  prestataire: CodePrestataire;
  statut: string;
  referenceInterne: string;
  referenceTransaction: string | null;
  montantAttenduCents: number;
  commandeNumero?: string;
};

export type VerdictConfirmation = "payee" | "montant_insuffisant" | "trop_percu" | "deja_traite" | "echec" | "inconnu" | "indetermine" | "erreur";

export type DependancesConfirmation = {
  adaptateur: (code: CodePrestataire) => PrestatairePaiement | null;
  tentativeParReference: (referenceInterne: string) => Promise<TentativeLue | null>;
  enregistrerNotification: (prestataire: CodePrestataire, idNotification: string, tentativeId: string | null, signatureValide: boolean) => Promise<boolean>;
  confirmer: (tentativeId: string, comparaison: "egal" | "inferieur" | "superieur", montantRecu: number, deviseRecue: string, referenceTransaction: string) => Promise<{ resultat: string } | { erreur: string }>;
  echouer: (tentativeId: string, cause: "client" | "prestataire") => Promise<void>;
  toucher: (tentativeId: string) => Promise<void>;
  signalerIndetermine: (tentativeId: string, montantRecu: number, deviseRecue: string) => Promise<void>;
  abandonnerPerimees: () => Promise<number>;
  lot: (limite: number, delaiSecondes: number) => Promise<TentativeLue[]>;
};

// Un résultat « succès » n'est cru que s'il porte un montant et une devise lisibles ; la comparaison au montant attendu est celle de
// l'adaptateur (documentation du Prestataire). Comparaison « indéterminée » : rien n'est validé, l'admin est prévenu (règle 15).
export async function appliquerResultat(
  deps: DependancesConfirmation,
  tentative: TentativeLue,
  adaptateur: PrestatairePaiement,
  resultat: ResultatAdaptateur,
): Promise<VerdictConfirmation> {
  try {
    if (resultat.statut === "echec_client" || resultat.statut === "echec_prestataire") {
      if (tentative.statut === "en_cours") await deps.echouer(tentative.id, resultat.statut === "echec_client" ? "client" : "prestataire");
      // Une Tentative qui n'est plus en cours n'est pas réinterrogée en boucle : elle passe en queue du lot.
      else await deps.toucher(tentative.id);
      return "echec";
    }
    if (resultat.statut !== "succes") {
      await deps.toucher(tentative.id);
      return "inconnu";
    }
    const montant = resultat.montantRecu === null ? Number.NaN : Number(resultat.montantRecu);
    const devise = resultat.deviseRecue;
    if (!Number.isFinite(montant) || montant < 0 || !devise || !/^[A-Z]{3}$/.test(devise)) {
      await deps.toucher(tentative.id);
      return "indetermine";
    }
    // La référence du Prestataire est exigée (règle 2) : celle du résultat, à défaut celle déjà enregistrée sur la Tentative.
    const reference = resultat.referenceTransaction ?? tentative.referenceTransaction;
    if (!reference) {
      await deps.toucher(tentative.id);
      return "indetermine";
    }
    const comparaison = adaptateur.comparerMontant(tentative.montantAttenduCents, resultat.montantRecu as string, devise);
    if (comparaison === "indetermine") {
      await deps.signalerIndetermine(tentative.id, montant, devise);
      await deps.toucher(tentative.id);
      return "indetermine";
    }
    const r = await deps.confirmer(tentative.id, comparaison, montant, devise, reference);
    if ("erreur" in r) {
      await deps.toucher(tentative.id).catch(() => undefined);
      return "erreur";
    }
    if (r.resultat === "reference_incoherente") return "erreur";
    return r.resultat === "payee" || r.resultat === "montant_insuffisant" || r.resultat === "trop_percu" || r.resultat === "deja_traite" ? r.resultat : "erreur";
  } catch {
    console.error("[paiement] application d'un résultat impossible");
    return "erreur";
  }
}

export type ReponseNotification = { code: 200; numero: string | null } | { code: 401 } | { code: 404 } | { code: 500 };

// Notification d'un Prestataire (route /api/paiement/notification/[prestataire]). L'adaptateur la vérifie (signature, ou contre-vérification
// auprès de l'API quand le Prestataire ne signe rien) : une vérification qui échoue répond 401 et ne change rien. Une transition refusée répond
// quand même 200 (le Prestataire ne doit pas rejouer sans fin) ; le refus est déjà une anomalie ou un trop-perçu en base.
export async function traiterNotification(deps: DependancesConfirmation, code: CodePrestataire, requete: RequeteNotification): Promise<ReponseNotification> {
  const adaptateur = deps.adaptateur(code);
  if (!adaptateur) return { code: 404 };
  try {
    const verifiee = await adaptateur.verifierNotification(requete);
    if (!verifiee) return { code: 401 };
    const tentative = verifiee.referenceInterne ? await deps.tentativeParReference(verifiee.referenceInterne) : null;
    // Une notification qui ne correspond à aucune Tentative (ou à celle d'un autre Prestataire) ne valide rien.
    const connue = tentative && tentative.prestataire === code ? tentative : null;
    await deps.enregistrerNotification(code, verifiee.idNotification, connue?.id ?? null, true);
    if (!connue) return { code: 200, numero: null };
    const verdict = await appliquerResultat(deps, connue, adaptateur, verifiee.resultat);
    // Panne côté base : 500 pour que le Prestataire rejoue ; la réconciliation rattrape de toute façon.
    if (verdict === "erreur") return { code: 500 };
    return { code: 200, numero: connue.commandeNumero ?? null };
  } catch {
    console.error("[paiement] notification impossible à traiter");
    return { code: 500 };
  }
}

export type BilanReconciliation = {
  abandonnees: number;
  interrogees: number;
  payees: number;
  echouees: number;
  encore_inconnues: number;
  ignorees: number;
  erreurs: number;
};

// Tâche reconcilier-tentatives : interroge chaque Prestataire branché pour les Tentatives sans réponse (en cours, ou abandonnées depuis moins de
// 72 h). Un Prestataire dont l'appel échoue laisse la Tentative en cours (AD-28) ; rien n'est jamais déduit d'un silence.
export async function reconcilier(deps: DependancesConfirmation, limite = 20, delaiSecondes = 60): Promise<BilanReconciliation> {
  const bilan: BilanReconciliation = { abandonnees: 0, interrogees: 0, payees: 0, echouees: 0, encore_inconnues: 0, ignorees: 0, erreurs: 0 };
  try {
    bilan.abandonnees = await deps.abandonnerPerimees();
  } catch {
    bilan.erreurs++;
  }
  let lot: TentativeLue[] = [];
  try {
    lot = await deps.lot(limite, delaiSecondes);
  } catch {
    bilan.erreurs++;
    return bilan;
  }
  for (const t of lot) {
    const adaptateur = deps.adaptateur(t.prestataire);
    if (!adaptateur) {
      bilan.ignorees++;
      continue;
    }
    bilan.interrogees++;
    let resultat: ResultatAdaptateur;
    try {
      resultat = await adaptateur.consulterStatut({ referenceInterne: t.referenceInterne, referenceTransaction: t.referenceTransaction });
    } catch {
      bilan.erreurs++;
      await deps.toucher(t.id).catch(() => undefined);
      continue;
    }
    const verdict = await appliquerResultat(deps, t, adaptateur, resultat);
    if (verdict === "payee" || verdict === "trop_percu" || verdict === "montant_insuffisant") bilan.payees++;
    else if (verdict === "echec") bilan.echouees++;
    else if (verdict === "erreur") bilan.erreurs++;
    else bilan.encore_inconnues++;
  }
  return bilan;
}
