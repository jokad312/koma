// Annulation par le client (FR-25, décision 10 de Jonathan du 2026-11-15) : miroir de la fonction SQL commande_contenu_annulable, qui fait
// foi. Une Commande payée (pas encore en fabrication) est annulable si elle contient un Cosplay (en stock compris) OU au moins une ligne
// physique fabriquée sur commande (origine « fabrication »), quelle que soit sa famille. Un Kit seul ou des articles en stock seuls (sans
// Cosplay) ne le sont pas.
export function contenuAnnulable(lignes: ReadonlyArray<{ famille: string; origine: string | null }>): boolean {
  return lignes.some((l) => l.famille === "cosplay" || (l.famille !== "kit" && l.famille !== "pass" && l.origine === "fabrication"));
}
