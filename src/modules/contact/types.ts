import type { AuteurVisiteur } from "@/lib/auth/auteur";

// Codes d'erreur renvoyés par l'action : le texte vient de messages/*.json, côté interface.
export type CodeErreurContact = "champs" | "trop_d_essais" | "generique";

export type ChampContact = "nom" | "email" | "message";
export type CodeChampContact = "nom_invalide" | "email_invalide" | "message_invalide";

export type ResultatContact =
  | { ok: true }
  | { ok: false; erreur: CodeErreurContact; champs: Partial<Record<ChampContact, CodeChampContact>> };

// Ce que le service attend du serveur : en production, les vrais clients ; en test, des faux nommés TEST_.
export type DependancesContact = {
  // Empreinte (hachage) de l'adresse IP du visiteur ; null si l'adresse est absente. L'adresse brute n'est jamais stockée.
  empreinteClient(): Promise<string | null>;
  // Empreinte (même HMAC que l'IP) d'une valeur déjà normalisée, ici l'email : l'email brut ne va ni dans limite_essai ni dans les logs.
  empreinteValeur(valeur: string): string;
  consommerEssai(args: { cle: string; fenetreSecondes: number; maximum: number }): Promise<{ erreur: string | null; autorise: boolean }>;
  enregistrerMessage(args: { auteur: AuteurVisiteur; nom: string; email: string; message: string; langue: string }): Promise<{ erreur: string | null }>;
};
