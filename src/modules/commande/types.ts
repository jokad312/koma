import type { Auteur } from "@/lib/auth/auteur";

export type CodeErreurCommande = "non_connecte" | "compte_incomplet" | "licence" | "deja_possede" | "indisponible" | "invalide" | "erreur";

export type ResultatCommande<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreurCommande };

export type CompteVerifie = { compteId: string; auteur: Auteur };

// Ce que le service attend de l'extérieur (en test, des faux nommés TEST_ les remplacent).
export type DependancesCommande = {
  // Session vérifiée + Compte complet ; lève une erreur portant le code KS_NON_CONNECTE, KS_COMPTE_INCOMPLET ou KS_VERIFICATION_IMPOSSIBLE.
  exigerCompte: () => Promise<CompteVerifie>;
  // Appelle offrir_commande ; renvoie le message d'erreur de la base (code KS_…) ou le numéro de la Commande.
  offrirCommande: (e: {
    auteur: Auteur;
    produitId: string;
    acceptations: { objet: string; version: string }[];
    cleIdempotence: string;
  }) => Promise<{ erreur: string | null; numero?: string }>;
};
