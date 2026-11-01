import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import type { ModeRemise, ZoneRemise } from "./schemas";

export type StatutAffiche = "en_attente" | "expiree" | "echouee" | "payee" | "en_fabrication" | "expediee" | "livree" | "annulee" | "remboursee" | "offerte";

export type LigneCommandeLue = {
  titre: string;
  slug: string;
  famille: string;
  taille: string | null;
  nombre: number;
  prixCents: number;
  origine: string | null;
  delaiFabricationJours: number | null;
};

export type CommandeLue = {
  numero: string;
  statut: StatutAffiche;
  sousTotalCents: number;
  forfaitCents: number;
  totalCents: number;
  expireLe: string | null;
  zone: ZoneRemise | null;
  mode: ModeRemise | null;
  lignes: LigneCommandeLue[];
};

const STATUTS: readonly StatutAffiche[] = ["en_attente", "expiree", "echouee", "payee", "en_fabrication", "expediee", "livree", "annulee", "remboursee", "offerte"];

// Une Commande en attente ou échouée dont l'échéance est passée s'affiche « expirée » même si la tâche planifiée n'est pas encore passée.
export function statutEffectif(statut: string, expireLe: string | null, maintenant: number): StatutAffiche | null {
  const s = STATUTS.find((x) => x === statut);
  if (!s) return null;
  if ((s === "en_attente" || s === "echouee") && expireLe && new Date(expireLe).getTime() <= maintenant) return "expiree";
  return s;
}

// Commande d'un Compte, lue par son numéro. Une Commande d'un autre Compte est introuvable (null). Lecture du serveur, jamais du navigateur.
export async function lireCommande(compteId: string, numero: string, langue: "fr" | "en"): Promise<CommandeLue | null> {
  if (!/^KS-[0-9]{4}-[0-9]{6,}$/.test(numero)) return null;
  const { data, error } = await creerClientService()
    .from("commande")
    .select(
      "numero, statut, sous_total_cents, forfait_cents, total_cents, expire_le, zone, mode_remise, ligne_commande(prix_cents, nombre, origine, delai_fabrication_jours, produit(slug, famille, titre_fr, titre_en), variante(taille))",
    )
    .eq("compte_id", compteId)
    .eq("numero", numero)
    .maybeSingle();
  if (error) throw new Error("lecture de la commande impossible");
  if (!data) return null;
  const statut = statutEffectif(data.statut, data.expire_le, Date.now());
  if (!statut) return null;
  const lignes = (data.ligne_commande ?? []).map((l) => {
    const produit = Array.isArray(l.produit) ? l.produit[0] : l.produit;
    const variante = Array.isArray(l.variante) ? l.variante[0] : l.variante;
    return {
      titre: langue === "en" && produit?.titre_en ? produit.titre_en : (produit?.titre_fr ?? ""),
      slug: produit?.slug ?? "",
      famille: produit?.famille ?? "",
      taille: variante?.taille ?? null,
      nombre: l.nombre,
      prixCents: l.prix_cents,
      origine: l.origine,
      delaiFabricationJours: l.delai_fabrication_jours,
    };
  });
  return {
    numero: data.numero,
    statut,
    sousTotalCents: data.sous_total_cents,
    forfaitCents: data.forfait_cents,
    totalCents: data.total_cents,
    expireLe: data.expire_le,
    zone: data.zone === "goma" || data.zone === "bukavu" ? data.zone : null,
    mode: data.mode_remise === "retrait" || data.mode_remise === "livraison" ? data.mode_remise : null,
    lignes,
  };
}

export type RemiseReprise = { zone: ZoneRemise | null; mode: ModeRemise | null; telephone: string | null; adresse: string | null };

// Dernière Commande du Compte qui a eu un téléphone ou une remise : sert à pré-remplir l'étape de commande (« Reprendre mon panier », FR-13).
export async function lireRemiseReprise(compteId: string): Promise<RemiseReprise | null> {
  const { data, error } = await creerClientService()
    .from("commande")
    .select("zone, mode_remise, telephone, adresse")
    .eq("compte_id", compteId)
    .not("telephone", "is", null)
    .order("cree_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    zone: data.zone === "goma" || data.zone === "bukavu" ? data.zone : null,
    mode: data.mode_remise === "retrait" || data.mode_remise === "livraison" ? data.mode_remise : null,
    telephone: data.telephone,
    adresse: data.adresse,
  };
}
