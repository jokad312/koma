// Auteur d'une écriture (AD-25), construit depuis la session vérifiée par le serveur, jamais depuis une saisie.
// Le rôle écrit ici sert à l'information du journal : la base revérifie toujours le droit par a_le_role (AD-13).
export type RoleAuteur = "admin" | "assistant" | "benevole" | null;

export type AuteurCompte = { type: "compte"; id: string; role: RoleAuteur };
// Auteur d'une commande du serveur (ex. npm run admin:attribuer) : jamais construit depuis une requête.
export type AuteurSysteme = { type: "systeme"; nom: string };
// Auteur d'un envoi sans Compte (formulaire de contact) : constante du serveur, jamais lue depuis une requête.
export type AuteurVisiteur = { type: "visiteur" };
export const AUTEUR_VISITEUR: AuteurVisiteur = { type: "visiteur" };
export type Auteur = AuteurCompte | AuteurSysteme | AuteurVisiteur;

export function construireAuteur(compteId: string, role: RoleAuteur = null): AuteurCompte {
  return { type: "compte", id: compteId, role };
}
