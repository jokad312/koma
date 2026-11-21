import "server-only";
import { z } from "zod";
import { DroitRefuseError, exigerDroit } from "@/lib/auth/droits";
import { creerClientService } from "@/lib/supabase/service";

// Point 4 de Jonathan (2026-11-21) : avant d'archiver un produit, nombre de Commandes EN COURS qui le contiennent (lecture seule, aucun blocage).
// En cours = payée, en fabrication ou expédiée (pas encore livrée), ou encore payable : en attente ou échouée avant son échéance (expire_le à venir,
// comme le paiement et les réservations l'acceptent ; sans échéance : non expirée). Seules les lignes PHYSIQUES comptent (avec une variante) : une Commande de Kits reste « payée »
// pour toujours (aucun suivi d'expédition) et ne doit pas déclencher l'alerte. Lignes annulées exclues. Le compte est fait PAR LA BASE sur la table
// commande (jointure obligatoire sur ses lignes) : chaque Commande compte une fois, sans limite de lignes renvoyées. Droit revérifié ici
// (produits.modifier), lecture par le client service.
export const STATUTS_AVANCES = ["payee", "en_fabrication", "expediee"] as const;
export const STATUTS_PAYABLES = ["en_attente", "echouee"] as const;

// Filtre PostgREST « or » : statuts avancés, ou statuts payables dont l'échéance n'est pas passée (instant donné par le serveur). Sans échéance :
// non expirée (même règle que la liste des commandes, commandes_admin_liste).
export function filtreEnCours(maintenant: Date): string {
  return `statut.in.(${STATUTS_AVANCES.join(",")}),and(statut.in.(${STATUTS_PAYABLES.join(",")}),or(expire_le.is.null,expire_le.gt.${maintenant.toISOString()}))`;
}

type Requete = {
  eq: (colonne: string, valeur: string | boolean) => Requete;
  not: (colonne: string, operateur: "is", valeur: null) => Requete;
  or: (filtre: string) => PromiseLike<{ count: number | null; error: { message: string } | null }>;
};
type ClientLecture = { from: (table: "commande") => { select: (colonnes: string, options: { count: "exact"; head: true }) => Requete } };

export type ResultatCommandesEnCours = { ok: true; nombre: number } | { ok: false; erreur: "non_autorise" | "introuvable" | "generique" };

export async function lireCommandesEnCoursProduit(id: unknown): Promise<ResultatCommandesEnCours> {
  try {
    await exigerDroit("produits.modifier");
  } catch (e) {
    if (e instanceof DroitRefuseError) return { ok: false, erreur: "non_autorise" };
    console.error("[catalogue] vérification du droit impossible");
    return { ok: false, erreur: "generique" };
  }
  if (!z.uuid().safeParse(id).success) return { ok: false, erreur: "introuvable" };
  try {
    const client = creerClientService() as unknown as ClientLecture;
    const { count, error } = await client
      .from("commande")
      .select("id, ligne_commande!inner(id)", { count: "exact", head: true })
      .eq("ligne_commande.produit_id", id as string)
      .eq("ligne_commande.annulee", false)
      .not("ligne_commande.variante_id", "is", null)
      .or(filtreEnCours(new Date()));
    if (error || count === null) throw new Error("lecture");
    return { ok: true, nombre: count };
  } catch {
    console.error("[catalogue] lecture des commandes en cours impossible");
    return { ok: false, erreur: "generique" };
  }
}
