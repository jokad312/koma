import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import { statutEffectif, type StatutAffiche } from "./queries";

// Lectures de l'admin pour les Commandes (story 6.2). Le droit est vérifié par la page avant tout appel ; la lecture passe par le client service.
export const TAILLE_PAGE_ADMIN = 12;

export const STATUTS_FILTRE = ["en_attente", "echouee", "expiree", "payee", "en_fabrication", "expediee", "livree", "annulee", "remboursee", "offerte"] as const;
export const FAMILLES_FILTRE = ["cosplay", "accessoire", "kit"] as const;
export const PRESTATAIRES_FILTRE = ["pawapay", "maishapay", "polar"] as const;
export const ZONES_FILTRE = ["goma", "bukavu"] as const;

export type FiltresCommandes = { statut?: string; famille?: string; prestataire?: string; zone?: string };

export function filtreValide<T extends string>(valeur: unknown, permises: readonly T[]): T | undefined {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return typeof v === "string" ? permises.find((p) => p === v) : undefined;
}

export type CommandeAdminResume = {
  numero: string;
  creeLe: string;
  statut: StatutAffiche;
  totalCents: number;
  offerte: boolean;
  prestataire: string | null;
  zone: string | null;
  modeRemise: string | null;
};

// Commandes filtrées, plus récentes d'abord. Le nombre total correspond aux filtres ; « reste » dit s'il y a une page de plus.
export async function listerCommandesAdmin(filtres: FiltresCommandes, nombre: number): Promise<{ commandes: CommandeAdminResume[]; total: number }> {
  const famille = filtres.famille ? "ligne_commande!inner(produit!inner(famille))" : "id";
  let q = creerClientService()
    .from("commande")
    .select(`numero, cree_le, statut, expire_le, total_cents, offerte, prestataire, zone, mode_remise, ${famille}`, { count: "exact" })
    .order("cree_le", { ascending: false })
    .limit(nombre);
  if (filtres.statut === "expiree") q = q.or(`statut.eq.expiree,and(statut.in.(en_attente,echouee),expire_le.lte.${new Date().toISOString()})`);
  else if (filtres.statut === "en_attente" || filtres.statut === "echouee") q = q.eq("statut", filtres.statut).gt("expire_le", new Date().toISOString());
  else if (filtres.statut === "offerte") q = q.eq("offerte", true);
  else if (filtres.statut) q = q.eq("statut", filtres.statut);
  if (filtres.prestataire) q = q.eq("prestataire", filtres.prestataire);
  if (filtres.zone) q = q.eq("zone", filtres.zone);
  if (filtres.famille) q = q.eq("ligne_commande.produit.famille", filtres.famille);
  const { data, error, count } = await q;
  if (error) throw new Error("lecture des commandes impossible");
  const maintenant = Date.now();
  const commandes = (data ?? []).flatMap((c) => {
    const ligne = c as unknown as { numero: string; cree_le: string; statut: string; expire_le: string | null; total_cents: number; offerte: boolean; prestataire: string | null; zone: string | null; mode_remise: string | null };
    const statut = statutEffectif(ligne.statut, ligne.expire_le, maintenant);
    return statut ? [{ numero: ligne.numero, creeLe: ligne.cree_le, statut, totalCents: ligne.total_cents, offerte: ligne.offerte, prestataire: ligne.prestataire, zone: ligne.zone, modeRemise: ligne.mode_remise }] : [];
  });
  return { commandes, total: count ?? commandes.length };
}

export type CommandeAdminDetail = {
  id: string;
  numero: string;
  statut: StatutAffiche;
  creeLe: string;
  sousTotalCents: number;
  forfaitCents: number;
  totalCents: number;
  devise: string;
  offerte: boolean;
  zone: string | null;
  modeRemise: string | null;
  telephone: string | null;
  adresse: string | null;
  numeroSuivi: string | null;
  prestataire: string | null;
  referenceTransaction: string | null;
  payeLe: string | null;
  moyen: string | null;
  demandeAnnulation: { id: string; statut: string } | null;
  remboursement: { montantCents: number; devise: string; valide: boolean } | null;
  reclamations: { id: string; statut: string; description: string; ligneTitre: string }[];
  tropPercus: { id: string; montantRecu: number; devise: string; motif: string }[];
  lignes: { id: string; titre: string; famille: string; taille: string | null; nombre: number; prixCents: number; origine: string | null; mesuresRecuesLe: string | null }[];
};

export async function lireCommandeAdmin(numero: string): Promise<CommandeAdminDetail | null> {
  if (!/^KS-[0-9]{4}-[0-9]{6,}$/.test(numero)) return null;
  const client = creerClientService();
  const { data, error } = await client
    .from("commande")
    .select(
      "id, numero, statut, expire_le, cree_le, sous_total_cents, forfait_cents, total_cents, devise, offerte, zone, mode_remise, telephone, adresse, numero_suivi, prestataire, reference_transaction, paye_le, ligne_commande(id, prix_cents, nombre, origine, mesures_recues_le, produit(famille, titre_fr), variante(taille))",
    )
    .eq("numero", numero)
    .maybeSingle();
  if (error) throw new Error("lecture de la commande impossible");
  if (!data) return null;
  const statut = statutEffectif(data.statut, data.expire_le, Date.now());
  if (!statut) return null;
  // Moyen de la Tentative réussie (lecture seule du bloc Paiement).
  const { data: tentative } = await client.from("tentative_paiement").select("moyen").eq("commande_id", data.id).eq("statut", "reussie").order("cree_le", { ascending: false }).limit(1).maybeSingle();
  const [demande, remboursement, tropPercus, reclamations] = await Promise.all([
    client.from("demande_client").select("id, statut").eq("commande_id", data.id).eq("type", "annulation_commande").order("cree_le", { ascending: false }).limit(1).maybeSingle(),
    client.from("remboursement").select("montant_cents, devise, valide_le").eq("cible_type", "commande").eq("cible_id", data.id).maybeSingle(),
    client.from("trop_percu").select("id, montant_recu, devise_recue, motif").eq("commande_id", data.id).eq("statut", "a_rembourser"),
    client.from("demande_client").select("id, statut, description, ligne_id").eq("commande_id", data.id).eq("type", "reclamation").order("cree_le", { ascending: false }),
  ]);
  if (demande.error || remboursement.error || tropPercus.error || reclamations.error) throw new Error("lecture des demandes impossible");
  return {
    id: data.id,
    numero: data.numero,
    statut,
    creeLe: data.cree_le,
    demandeAnnulation: demande.data ? { id: demande.data.id, statut: demande.data.statut } : null,
    remboursement: remboursement.data ? { montantCents: remboursement.data.montant_cents, devise: remboursement.data.devise, valide: remboursement.data.valide_le !== null } : null,
    reclamations: (reclamations.data ?? []).map((r) => ({
      id: r.id,
      statut: r.statut,
      description: r.description ?? "",
      ligneTitre: (data.ligne_commande ?? []).flatMap((l) => (l.id === r.ligne_id ? [(Array.isArray(l.produit) ? l.produit[0] : l.produit)?.titre_fr ?? ""] : []))[0] ?? "",
    })),
    tropPercus: (tropPercus.data ?? []).map((t) => ({ id: t.id, montantRecu: Number(t.montant_recu), devise: t.devise_recue, motif: t.motif })),
    sousTotalCents: data.sous_total_cents,
    forfaitCents: data.forfait_cents,
    totalCents: data.total_cents,
    devise: data.devise,
    offerte: data.offerte,
    zone: data.zone,
    modeRemise: data.mode_remise,
    telephone: data.telephone,
    adresse: data.adresse,
    numeroSuivi: data.numero_suivi,
    prestataire: data.prestataire,
    referenceTransaction: data.reference_transaction,
    payeLe: data.paye_le,
    moyen: tentative?.moyen ?? null,
    lignes: (data.ligne_commande ?? []).map((l) => {
      const produit = Array.isArray(l.produit) ? l.produit[0] : l.produit;
      const variante = Array.isArray(l.variante) ? l.variante[0] : l.variante;
      return { id: l.id, titre: produit?.titre_fr ?? "", famille: produit?.famille ?? "", taille: variante?.taille ?? null, nombre: l.nombre, prixCents: l.prix_cents, origine: l.origine, mesuresRecuesLe: l.mesures_recues_le };
    }),
  };
}

export type MesuresARecevoir = { numero: string; lignes: number };

// Tâche « Mesures à recevoir » (story 6.5) : lignes Sur-mesure de Commandes payées dont la réception des mesures n'est pas confirmée.
// Compteur réel, lu en base ; une lecture impossible lève une erreur (jamais un faux zéro).
export async function lireMesuresARecevoir(): Promise<{ total: number; commandes: MesuresARecevoir[] }> {
  const { data, error } = await creerClientService()
    .from("ligne_commande")
    .select("id, commande:commande_id!inner(numero, statut), variante:variante_id!inner(taille)")
    .eq("variante.taille", "sur_mesure")
    .is("mesures_recues_le", null)
    .eq("commande.statut", "payee");
  if (error) throw new Error("lecture des mesures à recevoir impossible");
  const parNumero = new Map<string, number>();
  for (const l of data ?? []) {
    const c = Array.isArray(l.commande) ? l.commande[0] : l.commande;
    if (c) parNumero.set(c.numero, (parNumero.get(c.numero) ?? 0) + 1);
  }
  return { total: data?.length ?? 0, commandes: [...parNumero.entries()].map(([numero, lignes]) => ({ numero, lignes })).sort((a, b) => a.numero.localeCompare(b.numero)) };
}

export type TacheRemboursement = { type: "demande" | "remboursement" | "trop_percu" | "reclamation"; numero: string; cibleId: string };

// Tâches d'argent (story 6.6) : demandes d'annulation ouvertes, remboursements d'annulation non confirmés, Trop-perçus à rembourser. Lecture impossible : erreur.
export async function lireTachesRemboursement(): Promise<TacheRemboursement[]> {
  const client = creerClientService();
  const [demandes, rembs, trops, reclamations] = await Promise.all([
    client.from("demande_client").select("id, commande:commande_id(numero)").eq("type", "annulation_commande").eq("statut", "ouverte"),
    client.from("remboursement").select("cible_id").eq("cible_type", "commande").is("valide_le", null),
    client.from("trop_percu").select("id, commande:commande_id(numero)").eq("statut", "a_rembourser"),
    client.from("demande_client").select("id, commande:commande_id(numero)").eq("type", "reclamation").in("statut", ["ouverte", "acceptee", "article_rendu"]),
  ]);
  if (demandes.error || rembs.error || trops.error || reclamations.error) throw new Error("lecture des tâches de remboursement impossible");
  const numero = (c: unknown) => {
    const x = Array.isArray(c) ? c[0] : c;
    return (x as { numero?: string } | null)?.numero ?? null;
  };
  const taches: TacheRemboursement[] = [];
  for (const d of demandes.data ?? []) {
    const n = numero(d.commande);
    if (n) taches.push({ type: "demande", numero: n, cibleId: d.id });
  }
  const ids = (rembs.data ?? []).map((r) => r.cible_id);
  if (ids.length > 0) {
    const { data, error } = await client.from("commande").select("id, numero").in("id", ids);
    if (error) throw new Error("lecture des tâches de remboursement impossible");
    for (const c of data ?? []) taches.push({ type: "remboursement", numero: c.numero, cibleId: c.id });
  }
  for (const t of trops.data ?? []) {
    const n = numero(t.commande);
    if (n) taches.push({ type: "trop_percu", numero: n, cibleId: t.id });
  }
  for (const r of reclamations.data ?? []) {
    const n = numero(r.commande);
    if (n) taches.push({ type: "reclamation", numero: n, cibleId: r.id });
  }
  return taches;
}
