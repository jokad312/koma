import type { Achat, CodePrestataire, Couverture, MoyenPaiement } from "./types";

// Raison pour laquelle aucun Prestataire n'est proposé. Aucune substitution : un Prestataire n'est jamais inventé ni remplacé.
export type RaisonIndisponible = "carte_indisponible" | "mobile_money_indisponible";

export type ChoixPrestataire = { statut: "ok"; prestataire: CodePrestataire } | { statut: "indisponible"; raison: RaisonIndisponible };

export type EntreeAiguillage = {
  achat: Achat;
  moyen: MoyenPaiement;
  pays: string | null;
  operateur: string | null;
  // Codes des Prestataires actifs.
  prestatairesActifs: readonly CodePrestataire[];
  couverture: Couverture;
  // Ordre de priorité des Agrégateurs (le premier est interrogé en premier).
  ordre: readonly CodePrestataire[];
  // Agrégateurs dont une Tentative de cette Commande a fini en « echec_prestataire » (repli vers le suivant du même couple).
  exclus: readonly CodePrestataire[];
};

// Seule source du choix de Prestataire (AD-6, règles 9 à 11). Fonction pure : les Familles viennent de la base, lues par le service.
//  - carte + Pass, ou carte + au moins un Produit physique (cosplay, accessoire) : MaishaPay, jamais Polar ;
//  - carte + Panier 100 % numérique (Kits) : Polar, sinon « carte indisponible » ;
//  - mobile money : premier Agrégateur actif, non exclu, qui couvre le couple pays-opérateur, dans l'ordre de priorité.
export function choisirPrestataire(entree: EntreeAiguillage): ChoixPrestataire {
  const { achat, moyen, prestatairesActifs } = entree;
  const actifs = new Set(prestatairesActifs);

  if (moyen === "carte") {
    if (!achat.estPass && achat.familles.length === 0) return { statut: "indisponible", raison: "carte_indisponible" };
    const physique = achat.familles.some((f) => f === "cosplay" || f === "accessoire");
    if (achat.estPass || physique) {
      return actifs.has("maishapay") ? { statut: "ok", prestataire: "maishapay" } : { statut: "indisponible", raison: "carte_indisponible" };
    }
    return actifs.has("polar") ? { statut: "ok", prestataire: "polar" } : { statut: "indisponible", raison: "carte_indisponible" };
  }

  if (!entree.pays || !entree.operateur) return { statut: "indisponible", raison: "mobile_money_indisponible" };
  const exclus = new Set(entree.exclus);
  for (const code of entree.ordre) {
    // Polar n'encaisse jamais de mobile money : seuls les Agrégateurs sont candidats.
    if (code === "polar" || !actifs.has(code) || exclus.has(code)) continue;
    if (entree.couverture.some((c) => c.prestataire === code && c.pays === entree.pays && c.operateur === entree.operateur)) {
      return { statut: "ok", prestataire: code };
    }
  }
  return { statut: "indisponible", raison: "mobile_money_indisponible" };
}
