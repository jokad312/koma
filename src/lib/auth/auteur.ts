// Auteur d'une écriture (AD-25), construit depuis la session vérifiée par le serveur, jamais depuis une saisie.
// Le rôle reste null jusqu'à la story 1.7 (rôles et droits).
export type Auteur = { type: "compte"; id: string; role: null };

export function construireAuteur(compteId: string): Auteur {
  return { type: "compte", id: compteId, role: null };
}
