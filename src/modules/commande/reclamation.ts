// Réclamation du client (story 6.7, FR-26). Le Compte est celui de la session ; la base relit la Commande et vérifie les 48 heures, la famille et la taille
// (calcul avec now(), AD-23). Aucune photo n'est demandée ; aucun remboursement n'est proposé.
export type ErreurReclamation = "non_connecte" | "entree_invalide" | "description_requise" | "commande_introuvable" | "reclamation_impossible" | "generique";
export type ResultatReclamation = { ok: true } | { ok: false; erreur: ErreurReclamation };

export type DependancesReclamation = {
  compteId: () => Promise<string | null>;
  signaler: (compteId: string, numero: string, ligneId: string, description: string) => Promise<{ erreur: string | null }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function signalerProbleme(deps: DependancesReclamation, entree: { numero: string; ligneId: string; description: string }): Promise<ResultatReclamation> {
  if (typeof entree.numero !== "string" || !/^KS-[0-9]{4}-[0-9]{6,}$/.test(entree.numero) || typeof entree.ligneId !== "string" || !UUID.test(entree.ligneId)) return { ok: false, erreur: "entree_invalide" };
  const description = typeof entree.description === "string" ? entree.description.trim() : "";
  if (description.length < 1 || description.length > 2000) return { ok: false, erreur: "description_requise" };
  try {
    const compteId = await deps.compteId();
    if (!compteId) return { ok: false, erreur: "non_connecte" };
    const { erreur } = await deps.signaler(compteId, entree.numero, entree.ligneId, description);
    if (!erreur) return { ok: true };
    if (erreur.includes("KS_COMMANDE_INTROUVABLE")) return { ok: false, erreur: "commande_introuvable" };
    if (erreur.includes("KS_RECLAMATION_IMPOSSIBLE") || erreur.includes("demande_reclamation_unique")) return { ok: false, erreur: "reclamation_impossible" };
    if (erreur.includes("KS_DESCRIPTION_REQUISE")) return { ok: false, erreur: "description_requise" };
    return { ok: false, erreur: "generique" };
  } catch {
    console.error("[commande] réclamation impossible");
    return { ok: false, erreur: "generique" };
  }
}
