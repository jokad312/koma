import { z } from "zod";

export type ErreurAnnulationPass = "non_connecte" | "entree_invalide" | "impossible" | "deja" | "reglage" | "generique";
export type ResultatAnnulationPass = { ok: true } | { ok: false; erreur: ErreurAnnulationPass };

export type DependancesAnnulationPass = {
  // Compte de la session vérifiée (jamais une saisie) ; null : pas de session.
  session: () => Promise<{ compteId: string } | null>;
  demander: (compteId: string, passId: string) => Promise<{ erreur: string | null }>;
};

const TABLE: Array<[string, ErreurAnnulationPass]> = [
  ["KS_PASS_INTROUVABLE", "impossible"],
  ["KS_ANNULATION_IMPOSSIBLE", "impossible"],
  ["KS_DEMANDE_EN_COURS", "deja"],
  ["KS_REGLAGE_MANQUANT", "reglage"],
];

// « Demander l'annulation » (story 7.9, FR-38) : le Compte vient de la session, le délai de 48 heures, la propriété du Pass et les frais sont
// revérifiés en base (demander_annulation_pass). Une erreur inconnue reste générique : aucun message de la base n'est montré.
export async function demanderAnnulationPass(deps: DependancesAnnulationPass, entree: { passId: string }): Promise<ResultatAnnulationPass> {
  const id = z.string().uuid().safeParse(entree.passId);
  if (!id.success) return { ok: false, erreur: "entree_invalide" };
  try {
    const session = await deps.session();
    if (!session) return { ok: false, erreur: "non_connecte" };
    const { erreur } = await deps.demander(session.compteId, id.data);
    if (erreur) return { ok: false, erreur: TABLE.find(([code]) => erreur.includes(code))?.[1] ?? "generique" };
    return { ok: true };
  } catch {
    console.error("[pass] demande d'annulation impossible");
    return { ok: false, erreur: "generique" };
  }
}
