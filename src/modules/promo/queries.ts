import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import type { CodePromo } from "./types";

// Lecture admin des Codes promo (story 9.1). `code_promo` est absente des types générés (fichier non modifiable ici) : le
// client est décrit localement. Une erreur de lecture est relancée, jamais masquée par une liste vide.

type LigneCodePromo = {
  id: string;
  code: string;
  affilie: string;
  reduction_pct: number | string;
  commission_pct: number | string;
  plafond: number;
  actif: boolean;
  cree_le: string;
  modifie_le: string;
};

type ClientLecture = {
  from: (table: string) => {
    select: (colonnes: string) => {
      order: (colonne: string, options?: { ascending?: boolean }) => PromiseLike<{ data: LigneCodePromo[] | null; error: { message: string } | null }>;
    };
  };
};

export async function lireCodesPromoAdmin(): Promise<CodePromo[]> {
  const client = creerClientService() as unknown as ClientLecture;
  const { data, error } = await client
    .from("code_promo")
    .select("id, code, affilie, reduction_pct, commission_pct, plafond, actif, cree_le, modifie_le")
    .order("code", { ascending: true });
  if (error) throw new Error("Lecture des codes promo impossible.");
  return (data ?? []).map((l) => ({
    id: l.id,
    code: l.code,
    affilie: l.affilie,
    reductionPct: Number(l.reduction_pct),
    commissionPct: Number(l.commission_pct),
    plafond: l.plafond,
    actif: l.actif,
    creeLe: l.cree_le,
    modifieLe: l.modifie_le,
  }));
}
