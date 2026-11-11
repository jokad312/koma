import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import type { ModeRemise, ZoneRemise } from "./schemas";

export type StatutAffiche = "en_attente" | "expiree" | "echouee" | "payee" | "en_fabrication" | "expediee" | "livree" | "annulee" | "remboursee" | "offerte";

export type LigneCommandeLue = {
  id: string;
  titre: string;
  slug: string;
  famille: string;
  taille: string | null;
  nombre: number;
  prixCents: number;
  origine: string | null;
  delaiFabricationJours: number | null;
  // Date de réception des mesures d'une ligne Sur-mesure, confirmée par l'admin (story 6.5) ; aucune mesure n'est stockée.
  mesuresRecuesLe: string | null;
  // Ligne de Pass (story 7.4) : noms figés des titulaires et Événement ; null pour une ligne de produit.
  pass: { titulaires: string[]; evenement: string } | null;
};

export type CommandeLue = {
  id: string;
  numero: string;
  statut: StatutAffiche;
  sousTotalCents: number;
  forfaitCents: number;
  totalCents: number;
  expireLe: string | null;
  zone: ZoneRemise | null;
  mode: ModeRemise | null;
  lignes: LigneCommandeLue[];
  // « produits » ou « pass » (story 7.4) : une Commande de Pass n'a ni livraison ni frise de fabrication.
  type: "produits" | "pass";
  offerte: boolean;
  creeLe: string;
  // Dates de la frise des statuts (story 6.1) et numéro de suivi saisi à la main, affiché tel quel (règle 12).
  dates: { payee: string | null; en_fabrication: string | null; expediee: string | null; livree: string | null };
  numeroSuivi: string | null;
  // Annulation (story 6.6) : le bouton n'existe que pour une Commande payée avec un Cosplay, sans demande en cours.
  annulable: boolean;
  demandeAnnulation: "ouverte" | "acceptee" | "refusee" | "close" | null;
  // Réclamations (story 6.7) : lignes réclamables (48 h, calcul en base) et état réel de chaque réclamation.
  lignesReclamables: string[];
  reclamations: { ligneId: string; statut: string }[];
  // Code promo figé avec la Commande (story 9.2) : le code et la réduction totale. Le taux de commission n'est jamais lu ici.
  codePromo: { code: string; reductionCents: number } | null;
};

export type CommandeResume = { numero: string; statut: StatutAffiche; creeLe: string; totalCents: number; offerte: boolean; reclamation: string | null };

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
      "id, numero, type, statut, sous_total_cents, forfait_cents, total_cents, expire_le, zone, mode_remise, offerte, cree_le, paye_le, fabrication_le, expediee_le, livree_le, numero_suivi, ligne_commande(id, prix_cents, nombre, origine, delai_fabrication_jours, mesures_recues_le, titulaires, pass_nom_fr, pass_nom_en, produit(slug, famille, titre_fr, titre_en), variante(taille), type_pass(evenement(titre_fr, titre_en)))",
    )
    .eq("compte_id", compteId)
    .eq("numero", numero)
    .maybeSingle();
  if (error) throw new Error("lecture de la commande impossible");
  if (!data) return null;
  const statut = statutEffectif(data.statut, data.expire_le, Date.now());
  if (!statut) return null;
  const { data: demande } = await creerClientService()
    .from("demande_client")
    .select("statut")
    .eq("commande_id", data.id)
    .eq("type", "annulation_commande")
    .order("cree_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  const demandeAnnulation = demande && ["ouverte", "acceptee", "refusee", "close"].includes(demande.statut) ? (demande.statut as "ouverte" | "acceptee" | "refusee" | "close") : null;
  const [reclamables, reclamations, promo] = await Promise.all([
    creerClientService().rpc("lignes_reclamables", { p_compte: compteId, p_numero: numero }),
    creerClientService().from("demande_client").select("ligne_id, statut").eq("commande_id", data.id).eq("type", "reclamation").order("cree_le", { ascending: false }),
    creerClientService().from("commande_code_promo").select("code, reduction_cents").eq("commande_id", data.id).maybeSingle(),
  ]);
  if (reclamables.error || reclamations.error) throw new Error("lecture des réclamations impossible");
  if (promo.error) throw new Error("lecture du code promo impossible");
  const lignes = (data.ligne_commande ?? []).map((l) => {
    const produit = Array.isArray(l.produit) ? l.produit[0] : l.produit;
    const variante = Array.isArray(l.variante) ? l.variante[0] : l.variante;
    const typePass = Array.isArray(l.type_pass) ? l.type_pass[0] : l.type_pass;
    const evenementBrut = typePass ? (Array.isArray(typePass.evenement) ? typePass.evenement[0] : typePass.evenement) : null;
    const estPass = !produit && Array.isArray(l.titulaires);
    return {
      id: l.id,
      titre: estPass ? (langue === "en" && l.pass_nom_en ? l.pass_nom_en : (l.pass_nom_fr ?? "")) : langue === "en" && produit?.titre_en ? produit.titre_en : (produit?.titre_fr ?? ""),
      slug: produit?.slug ?? "",
      famille: estPass ? "pass" : (produit?.famille ?? ""),
      pass: estPass
        ? {
            titulaires: (l.titulaires as unknown[]).filter((n): n is string => typeof n === "string"),
            evenement: evenementBrut ? (langue === "en" && evenementBrut.titre_en ? evenementBrut.titre_en : evenementBrut.titre_fr) : "",
          }
        : null,
      taille: variante?.taille ?? null,
      nombre: l.nombre,
      prixCents: l.prix_cents,
      origine: l.origine,
      delaiFabricationJours: l.delai_fabrication_jours,
      mesuresRecuesLe: l.mesures_recues_le,
    };
  });
  return {
    id: data.id,
    numero: data.numero,
    statut,
    sousTotalCents: data.sous_total_cents,
    forfaitCents: data.forfait_cents,
    totalCents: data.total_cents,
    expireLe: data.expire_le,
    zone: data.zone === "goma" || data.zone === "bukavu" ? data.zone : null,
    mode: data.mode_remise === "retrait" || data.mode_remise === "livraison" ? data.mode_remise : null,
    lignes,
    type: data.type === "pass" ? "pass" : "produits",
    offerte: data.offerte,
    creeLe: data.cree_le,
    dates: { payee: data.paye_le, en_fabrication: data.fabrication_le, expediee: data.expediee_le, livree: data.livree_le },
    numeroSuivi: data.numero_suivi,
    annulable: statut === "payee" && !data.offerte && lignes.some((l) => l.famille === "cosplay") && (demandeAnnulation === null || demandeAnnulation === "refusee"),
    demandeAnnulation,
    lignesReclamables: (reclamables.data ?? []).map((r) => r.ligne_id),
    reclamations: (reclamations.data ?? []).flatMap((r) => (r.ligne_id ? [{ ligneId: r.ligne_id, statut: r.statut }] : [])),
    codePromo: promo.data ? { code: promo.data.code, reductionCents: promo.data.reduction_cents } : null,
  };
}

export const TAILLE_PAGE_COMMANDES = 12;

// Commandes du Compte, les plus récentes d'abord, par pages de 12 (« Voir plus »). On lit une ligne de plus pour savoir s'il en reste.
export async function listerCommandes(compteId: string, nombre: number): Promise<{ commandes: CommandeResume[]; reste: boolean }> {
  const { data, error } = await creerClientService()
    .from("commande")
    .select("id, numero, statut, total_cents, expire_le, cree_le, offerte")
    .eq("compte_id", compteId)
    .order("cree_le", { ascending: false })
    .limit(nombre + 1);
  if (error) throw new Error("lecture des commandes impossible");
  const maintenant = Date.now();
  // État réel de la dernière réclamation de chaque Commande listée (story 6.7).
  const visibles = (data ?? []).slice(0, nombre);
  const { data: demandes, error: erreurDemandes } = await creerClientService().from("demande_client").select("commande_id, statut, cree_le").eq("type", "reclamation").in("commande_id", visibles.map((c) => c.id)).order("cree_le", { ascending: false });
  if (erreurDemandes) throw new Error("lecture des réclamations impossible");
  const commandes = visibles.flatMap((c) => {
    const statut = statutEffectif(c.statut, c.expire_le, maintenant);
    return statut ? [{ numero: c.numero, statut, creeLe: c.cree_le, totalCents: c.total_cents, offerte: c.offerte, reclamation: (demandes ?? []).find((d) => d.commande_id === c.id)?.statut ?? null }] : [];
  });
  return { commandes, reste: (data ?? []).length > nombre };
}

// Numéro de la Commande à payer (en attente ou échouée, échéance non passée) du Compte, ou null. Une seule est possible à la fois.
export async function lireNumeroCommandeAPayer(compteId: string): Promise<string | null> {
  const { data, error } = await creerClientService()
    .from("commande")
    .select("numero")
    .eq("compte_id", compteId)
    .in("statut", ["en_attente", "echouee"])
    .gt("expire_le", new Date().toISOString())
    .order("cree_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.numero;
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
