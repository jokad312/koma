import type { StatutAffiche } from "./queries";

// Frise des statuts d'une Commande (story 6.1, UX-DR38) : étapes réelles seulement, jamais de statut calculé (règle 12 : aucun « en transit »).
export type EtapeFrise = { cle: "payee" | "en_fabrication" | "expediee" | "livree"; etat: "fait" | "en_cours" | "a_venir"; date: string | null };

const ORDRE = ["payee", "en_fabrication", "expediee", "livree"] as const;

// Une Commande sans ligne physique (Kit seul) n'a pas de frise. L'étape « en fabrication » n'existe que si une ligne est fabriquée à la demande.
// La dernière étape atteinte est « en cours », sauf « livrée » qui est faite.
export function construireFrise(entree: {
  statut: StatutAffiche;
  physique: boolean;
  fabrication: boolean;
  dates: { payee: string | null; en_fabrication: string | null; expediee: string | null; livree: string | null };
}): EtapeFrise[] {
  if (!entree.physique) return [];
  const atteint = (ORDRE as readonly string[]).indexOf(entree.statut);
  if (atteint < 0) return [];
  const cles = ORDRE.filter((c) => c !== "en_fabrication" || entree.fabrication);
  return cles.map((cle) => {
    const rang = ORDRE.indexOf(cle);
    const etat = rang < atteint || (rang === atteint && cle === "livree") ? "fait" : rang === atteint ? "en_cours" : "a_venir";
    return { cle, etat, date: etat === "a_venir" ? null : entree.dates[cle] };
  });
}
