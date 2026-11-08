import type { Auteur } from "@/lib/auth/auteur";

// Préférences d'emails (story 9.4, FR-45, E-38). Trois objets de consentement ; la case unique de la création de Compte et de
// l'étape de commande donne « relances » et « nouveautes » (décision de Jonathan du 2026-11-08). « alertes_festival » se règle
// dans Préférences (et par « Me prévenir », story 7.3).
export const OBJETS_CONSENTEMENT = ["relances", "nouveautes", "alertes_festival"] as const;
export type ObjetConsentement = (typeof OBJETS_CONSENTEMENT)[number];

export const OBJETS_CASE_EMAILS: readonly ObjetConsentement[] = ["relances", "nouveautes"];

// Version du texte de la case et des interrupteurs (texte fourni par Jonathan le 2026-11-08). Un nouveau texte = une nouvelle
// version ; les consentements déjà donnés gardent la leur.
export const VERSION_CONSENTEMENT_EMAILS = "2026-11-08";

export type SourceConsentement = "creation_compte" | "commande" | "preferences";

export type Preferences = { relances: boolean; nouveautes: boolean; alertesFestival: boolean; mineurBloque: boolean };

export type ErreurPreferences = "non_connecte" | "invalide" | "erreur";
export type ResultatPreferences<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: ErreurPreferences };

export type { Auteur };

export type DependancesPreferences = {
  // null : non connecté ou Compte incomplet.
  compte: () => Promise<{ compteId: string; auteur: Auteur } | null>;
  lire: (compteId: string) => Promise<{ preferences: Preferences } | { erreur: string }>;
  regler: (auteur: Auteur, objet: ObjetConsentement, actif: boolean) => Promise<{ actif: boolean } | { erreur: string }>;
  desinscrire: (compteId: string) => Promise<{ fait: boolean } | { erreur: string }>;
};
