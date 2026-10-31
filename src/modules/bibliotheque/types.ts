// anonyme : pas de session ; incomplet : Compte sans âge déclaré ; pret : peut obtenir ; possede : a déjà l'accès.
export type EtatKit = "anonyme" | "incomplet" | "pret" | "possede";

export type DependancesBibliotheque = {
  // Identifiant du Compte de la session vérifiée, ou null.
  compteId: () => Promise<string | null>;
  possedeKit: (compteId: string, produitId: string) => Promise<boolean>;
  compteComplet: (compteId: string) => Promise<boolean>;
};
