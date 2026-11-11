import type { AuteurCompte } from "@/lib/auth/auteur";

// Accès bénévole (story 7.7, FR-37, AD-13) : un Compte peut scanner les Pass d'UN Événement, pendant le jour de cet Événement, et rien d'autre.
// Le bénévole ne reçoit aucun rôle. Seul l'Admin donne et retire l'accès (droit « benevoles.acces »).
export type StatutAttribution = "attribue" | "deja" | "mis_a_jour" | "sans_compte";

// Codes renvoyés par les actions : le texte vient de messages/*.json, côté interface.
export type CodeErreurBenevole = "email_invalide" | "evenement_passe" | "evenement_sans_date" | "non_connecte" | "non_autorise" | "generique";

export type ResultatAttribution = { ok: true; statut: StatutAttribution } | { ok: false; erreur: CodeErreurBenevole };
export type ResultatRetrait = { ok: true; retire: boolean } | { ok: false; erreur: CodeErreurBenevole };

// Un accès tel que l'Admin le voit (l'email n'est montré qu'à l'Admin). La validité est calculée par la base.
// « etat » est calculé côté serveur : valide maintenant (d'après la base), pas encore ouvert, ou terminé (échu, pas encore supprimé par la tâche).
export type EtatAcces = "valide" | "avenir" | "termine";
export type AccesBenevole = { id: string; email: string; valableDu: string; valableJusquAu: string; etat: EtatAcces };

export type DependancesBenevoles = {
  // Droit « benevoles.acces » vérifié en base ; lève KS_NON_CONNECTE / KS_DROIT_REFUSE.
  exigerDroit(): Promise<{ auteur: AuteurCompte }>;
  attribuer(a: { auteur: AuteurCompte; evenementId: string; email: string }): Promise<{ erreur: string | null; statut: string | null }>;
  retirer(a: { auteur: AuteurCompte; evenementId: string; accesId: string }): Promise<{ erreur: string | null; retire: boolean }>;
};
