// Codes promo (story 9.1, FR-46, AD-29) : la table décrit le code, elle ne compte jamais ses utilisations (story 9.2).
export type CodePromo = {
  id: string;
  code: string;
  affilie: string;
  reductionPct: number;
  commissionPct: number;
  plafond: number;
  actif: boolean;
  creeLe: string;
  modifieLe: string;
};

// Codes d'erreur du module : le texte affiché vient de messages/*.json, côté interface.
export type ErreurCodePromo =
  | "non_autorise"
  | "code_invalide"
  | "code_existant"
  | "affilie_invalide"
  | "reduction_invalide"
  | "commission_invalide"
  | "plafond_invalide"
  | "introuvable"
  | "generique";

export type ResultatCodePromo = { ok: true; id?: string } | { ok: false; erreur: ErreurCodePromo };

// Saisie du formulaire : les nombres arrivent en texte (champ contrôlé), le service les valide et les convertit.
export type EntreeCodePromo = {
  code: string;
  affilie: string;
  reductionPct: string;
  commissionPct: string;
  plafond: string;
  actif: boolean;
};

export type EntreeModificationCodePromo = Omit<EntreeCodePromo, "code">;

export type ValeursCodePromo = {
  affilie: string;
  reductionPct: number;
  commissionPct: number;
  plafond: number;
  actif: boolean;
};

export type DependancesCodePromo = {
  exigerDroit: () => Promise<{ auteur: unknown }>;
  creer: (auteur: unknown, code: string, valeurs: ValeursCodePromo) => Promise<{ erreur: string | null }>;
  modifier: (auteur: unknown, id: string, valeurs: ValeursCodePromo) => Promise<{ erreur: string | null }>;
};
