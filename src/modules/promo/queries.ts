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

// Ventes et commission due (story 9.3) : lues dans la vue commission_code_promo, seule source du calcul (AD-27).
type LigneCommission = { code_promo_id: string; ventes: number; montant_cents: number | string; commission_cents: number | string };
type ClientCommission = {
  from: (vue: string) => { select: (colonnes: string) => PromiseLike<{ data: LigneCommission[] | null; error: { message: string } | null }> };
};

export async function lireCodesPromoAdmin(): Promise<CodePromo[]> {
  const service = creerClientService();
  const [{ data, error }, ventes] = await Promise.all([
    (service as unknown as ClientLecture)
      .from("code_promo")
      .select("id, code, affilie, reduction_pct, commission_pct, plafond, actif, cree_le, modifie_le")
      .order("code", { ascending: true }),
    (service as unknown as ClientCommission).from("commission_code_promo").select("code_promo_id, ventes, montant_cents, commission_cents"),
  ]);
  if (error) throw new Error("Lecture des codes promo impossible.");
  if (ventes.error) throw new Error("Lecture des ventes par code promo impossible.");
  const parCode = new Map((ventes.data ?? []).map((v) => [v.code_promo_id, v]));
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
    // Un code absent de la vue n'a aucune vente : 0, jamais une valeur inventée.
    ventes: parCode.get(l.id)?.ventes ?? 0,
    montantCents: Number(parCode.get(l.id)?.montant_cents ?? 0),
    commissionCents: Number(parCode.get(l.id)?.commission_cents ?? 0),
  }));
}
