// Demande d'annulation par le client (story 6.6, FR-25). Le Compte est celui de la session, jamais une saisie ; la base vérifie la Commande (payée, avec
// un Cosplay, pas en fabrication). La demande n'annule rien : Jonathan l'accepte ou la refuse.
export type ErreurAnnulation = "non_connecte" | "entree_invalide" | "commande_introuvable" | "annulation_impossible" | "demande_en_cours" | "generique";
export type ResultatAnnulation = { ok: true } | { ok: false; erreur: ErreurAnnulation };

export type DependancesAnnulation = {
  compteId: () => Promise<string | null>;
  demander: (compteId: string, numero: string) => Promise<{ erreur: string | null }>;
};

export async function demanderAnnulation(deps: DependancesAnnulation, entree: { numero: string }): Promise<ResultatAnnulation> {
  if (typeof entree.numero !== "string" || !/^KS-[0-9]{4}-[0-9]{6,}$/.test(entree.numero)) return { ok: false, erreur: "entree_invalide" };
  try {
    const compteId = await deps.compteId();
    if (!compteId) return { ok: false, erreur: "non_connecte" };
    const { erreur } = await deps.demander(compteId, entree.numero);
    if (!erreur) return { ok: true };
    if (erreur.includes("KS_COMMANDE_INTROUVABLE")) return { ok: false, erreur: "commande_introuvable" };
    if (erreur.includes("KS_ANNULATION_IMPOSSIBLE")) return { ok: false, erreur: "annulation_impossible" };
    if (erreur.includes("KS_DEMANDE_EN_COURS") || erreur.includes("demande_annulation_unique")) return { ok: false, erreur: "demande_en_cours" };
    return { ok: false, erreur: "generique" };
  } catch {
    console.error("[commande] demande d'annulation impossible");
    return { ok: false, erreur: "generique" };
  }
}
