import "server-only";
import { FAMILLES_PRODUIT } from "@/modules/catalogue/types";
import type { AuteurCompte } from "@/lib/auth/auteur";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import { statutEffectif, type StatutAffiche } from "./queries";

// Lectures de l'admin pour les Commandes (story 6.2, liste refaite en 9.16 d). Le droit est vérifié par la page avant tout appel ; la liste passe par
// la fonction commandes_admin_liste (personnel revérifié en base, email masqué en base), le reste par le client service.
export const TAILLE_PAGE_ADMIN = 20;
export const LONGUEUR_RECHERCHE_MAX = 100;
const PAGE_MAX = 100_000;

export const STATUTS_FILTRE = ["en_attente", "echouee", "expiree", "payee", "en_fabrication", "expediee", "livree", "annulee", "remboursee", "offerte"] as const;
// Pastilles de la maquette (B5) : TOUTES (aucun statut), puis ces quatre statuts ; les autres restent dans la liste déroulante.
export const STATUTS_PASTILLES = ["payee", "echouee", "en_attente", "remboursee"] as const;
export const FAMILLES_FILTRE = FAMILLES_PRODUIT;
export const PRESTATAIRES_FILTRE = ["pawapay", "maishapay", "polar"] as const;
export const ZONES_FILTRE = ["goma", "bukavu"] as const;

export type FiltresCommandes = { statut?: string; famille?: string; prestataire?: string; zone?: string; q?: string };

export function filtreValide<T extends string>(valeur: unknown, permises: readonly T[]): T | undefined {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return typeof v === "string" ? permises.find((p) => p === v) : undefined;
}

// Recherche lue dans l'adresse : texte libre, espaces retirés aux bords, coupé à 100 caractères (par caractère : jamais un emoji coupé en deux) ;
// vide → aucune recherche. La base l'échappe (jokers compris) et la compare au numéro et au nom (partiel), et à l'email (adresse entière seulement).
export function rechercheValide(valeur: unknown): string | undefined {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  if (typeof v !== "string") return undefined;
  const texte = Array.from(v.trim()).slice(0, LONGUEUR_RECHERCHE_MAX).join("").trim();
  return texte === "" ? undefined : texte;
}

// Numéro de page lu dans l'adresse : entier de 1 à 100 000, sinon 1.
export function pageValide(valeur: unknown): number {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  if (typeof v !== "string" || !/^[0-9]{1,6}$/.test(v)) return 1;
  const n = Number(v);
  return n >= 1 && n <= PAGE_MAX ? n : 1;
}

export type ClientCommande = { nom: string | null; emailMasque: string | null };

export type CommandeAdminResume = {
  numero: string;
  creeLe: string;
  statut: StatutAffiche;
  totalCents: number;
  offerte: boolean;
  prestataire: string | null;
  zone: string | null;
  modeRemise: string | null;
  client: ClientCommande;
};

// Cartes de la page (B2), « depuis le début » ; le revenu est lu à part (lireRevenuPaye), seulement pour qui a le droit de le voir.
export type ChiffresCommandes = { commandesPayees: number; tentativesReussies: number; enAttente: number };

export type PageCommandesAdmin = { commandes: CommandeAdminResume[]; total: number; page: number; pages: number; chiffres: ChiffresCommandes };

type LigneListe = {
  numero: string;
  cree_le: string;
  statut: string;
  expire_le: string | null;
  total_cents: number;
  offerte: boolean;
  prestataire: string | null;
  zone: string | null;
  mode_remise: string | null;
  client_nom: string | null;
  client_email_masque: string | null;
};
type ReponseListe = { total: number; commandes: LigneListe[]; chiffres: { commandes_payees: number; tentatives_reussies: number; en_attente: number } };

function entier(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) throw new Error("lecture des commandes impossible");
  return v;
}

async function lirePage(auteur: AuteurCompte, filtres: FiltresCommandes, page: number): Promise<ReponseListe> {
  const { data, error } = await creerClientService().rpc("commandes_admin_liste", {
    p_auteur: auteur as unknown as Json,
    p_statut: filtres.statut,
    p_famille: filtres.famille,
    p_prestataire: filtres.prestataire,
    p_zone: filtres.zone,
    p_recherche: filtres.q,
    p_page: page,
    p_taille: TAILLE_PAGE_ADMIN,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("lecture des commandes impossible");
  const r = data as unknown as ReponseListe;
  if (!Array.isArray(r.commandes) || !r.chiffres) throw new Error("lecture des commandes impossible");
  return r;
}

// Commandes filtrées et recherchées, plus récentes d'abord, par pages de 20. Une page au-delà de la dernière (adresse modifiée, Commandes
// disparues entre deux clics) affiche la dernière page. Une lecture impossible lève une erreur (jamais une liste vide inventée).
export async function listerCommandesAdmin(auteur: AuteurCompte, filtres: FiltresCommandes, page: number): Promise<PageCommandesAdmin> {
  const nombrePages = (total: number) => Math.max(1, Math.ceil(total / TAILLE_PAGE_ADMIN));
  let r = await lirePage(auteur, filtres, page);
  let courante = page;
  if (r.commandes.length === 0 && entier(r.total) > 0 && page > nombrePages(entier(r.total))) {
    courante = nombrePages(entier(r.total));
    r = await lirePage(auteur, filtres, courante);
  }
  const total = entier(r.total);
  const pages = nombrePages(total);
  const maintenant = Date.now();
  const commandes = r.commandes.flatMap((c) => {
    const statut = statutEffectif(c.statut, c.expire_le, maintenant);
    return statut
      ? [
          {
            numero: c.numero,
            creeLe: c.cree_le,
            statut,
            totalCents: c.total_cents,
            offerte: c.offerte,
            prestataire: c.prestataire,
            zone: c.zone,
            modeRemise: c.mode_remise,
            client: { nom: c.client_nom, emailMasque: c.client_email_masque },
          },
        ]
      : [];
  });
  return {
    commandes,
    total,
    page: Math.min(courante, pages),
    pages,
    chiffres: { commandesPayees: entier(r.chiffres.commandes_payees), tentativesReussies: entier(r.chiffres.tentatives_reussies), enAttente: entier(r.chiffres.en_attente) },
  };
}

// Carte REVENU PAYÉ : même chiffre que REVENU TOTAL du tableau de bord (tableau_chiffres, Admin seulement, revérifié en base). À n'appeler que
// pour qui a le droit chiffre_affaires.voir. Lecture impossible : null (la carte le dit, jamais un faux zéro).
export async function lireRevenuPaye(auteur: AuteurCompte): Promise<number | null> {
  const { data, error } = await creerClientService().rpc("tableau_chiffres", { p_auteur: auteur as unknown as Json });
  const ligne = Array.isArray(data) ? data[0] : null;
  const revenu = Number(ligne?.revenu_cents);
  if (error || !ligne || !Number.isSafeInteger(revenu) || revenu < 0) {
    console.error("[commande] revenu payé illisible");
    return null;
  }
  return revenu;
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
  // Demandes d'annulation de Pass (story 7.9) ; le remboursement est rattaché au Pass de la demande.
  annulationsPass: { demandeId: string; statut: string; passId: string; nomTitulaire: string; remboursement: { montantCents: number; devise: string; valide: boolean } | null }[];
  reclamations: { id: string; statut: string; description: string; ligneTitre: string; ligneNombre: number }[];
  tropPercus: { id: string; montantRecu: number; devise: string; motif: string }[];
  lignes: { id: string; titre: string; famille: string; taille: string | null; couleur?: string | null; nombre: number; prixCents: number; origine: string | null; mesuresRecuesLe: string | null }[];
  // Code promo figé avec la Commande (story 9.2) ; les taux sont ceux du jour de la commande.
  codePromo: { code: string; reductionCents: number; reductionPct: number; commissionPct: number } | null;
};

export async function lireCommandeAdmin(numero: string): Promise<CommandeAdminDetail | null> {
  if (!/^KS-[0-9]{4}-[0-9]{6,}$/.test(numero)) return null;
  const client = creerClientService();
  const { data, error } = await client
    .from("commande")
    .select(
      "id, numero, statut, expire_le, cree_le, sous_total_cents, forfait_cents, total_cents, devise, offerte, zone, mode_remise, telephone, adresse, numero_suivi, prestataire, reference_transaction, paye_le, ligne_commande(id, prix_cents, nombre, origine, mesures_recues_le, pass_nom_fr, produit(famille, titre_fr), variante(taille, couleur_fr))",
    )
    .eq("numero", numero)
    .maybeSingle();
  if (error) throw new Error("lecture de la commande impossible");
  if (!data) return null;
  const statut = statutEffectif(data.statut, data.expire_le, Date.now());
  if (!statut) return null;
  // Moyen de la Tentative réussie (lecture seule du bloc Paiement).
  const { data: tentative } = await client.from("tentative_paiement").select("moyen").eq("commande_id", data.id).eq("statut", "reussie").order("cree_le", { ascending: false }).limit(1).maybeSingle();
  const [demande, remboursement, tropPercus, reclamations, promo, demandesPass] = await Promise.all([
    client.from("demande_client").select("id, statut").eq("commande_id", data.id).eq("type", "annulation_commande").order("cree_le", { ascending: false }).limit(1).maybeSingle(),
    client.from("remboursement").select("montant_cents, devise, valide_le").eq("cible_type", "commande").eq("cible_id", data.id).maybeSingle(),
    client.from("trop_percu").select("id, montant_recu, devise_recue, motif").eq("commande_id", data.id).eq("statut", "a_rembourser"),
    client.from("demande_client").select("id, statut, description, ligne_id").eq("commande_id", data.id).eq("type", "reclamation").order("cree_le", { ascending: false }),
    client.from("commande_code_promo").select("code, reduction_cents, reduction_pct, commission_pct").eq("commande_id", data.id).maybeSingle(),
    client.from("demande_client").select("id, statut, pass_id, pass:pass_id(nom_titulaire)").eq("commande_id", data.id).eq("type", "annulation_pass").order("cree_le", { ascending: true }),
  ]);
  if (demande.error || remboursement.error || tropPercus.error || reclamations.error) throw new Error("lecture des demandes impossible");
  if (promo.error) throw new Error("lecture du code promo impossible");
  if (demandesPass.error) throw new Error("lecture des demandes de Pass impossible");
  const idsPass = (demandesPass.data ?? []).flatMap((d) => (d.pass_id ? [d.pass_id] : []));
  const remboursementsPass = idsPass.length > 0 ? await client.from("remboursement").select("cible_id, montant_cents, devise, valide_le").eq("cible_type", "pass").in("cible_id", idsPass) : { data: [], error: null };
  if (remboursementsPass.error) throw new Error("lecture des remboursements de Pass impossible");
  return {
    id: data.id,
    numero: data.numero,
    statut,
    creeLe: data.cree_le,
    demandeAnnulation: demande.data ? { id: demande.data.id, statut: demande.data.statut } : null,
    remboursement: remboursement.data ? { montantCents: remboursement.data.montant_cents, devise: remboursement.data.devise, valide: remboursement.data.valide_le !== null } : null,
    annulationsPass: (demandesPass.data ?? []).flatMap((d) => {
      if (!d.pass_id) return [];
      const r = (remboursementsPass.data ?? []).find((x) => x.cible_id === d.pass_id);
      const pass = Array.isArray(d.pass) ? d.pass[0] : d.pass;
      return [{ demandeId: d.id, statut: d.statut, passId: d.pass_id, nomTitulaire: pass?.nom_titulaire ?? "", remboursement: r ? { montantCents: r.montant_cents, devise: r.devise, valide: r.valide_le !== null } : null }];
    }),
    reclamations: (reclamations.data ?? []).map((r) => ({
      id: r.id,
      statut: r.statut,
      description: r.description ?? "",
      ligneTitre: (data.ligne_commande ?? []).flatMap((l) => (l.id === r.ligne_id ? [(Array.isArray(l.produit) ? l.produit[0] : l.produit)?.titre_fr ?? ""] : []))[0] ?? "",
      ligneNombre: (data.ligne_commande ?? []).find((l) => l.id === r.ligne_id)?.nombre ?? 1,
    })),
    tropPercus: (tropPercus.data ?? []).map((t) => ({ id: t.id, montantRecu: Number(t.montant_recu), devise: t.devise_recue, motif: t.motif })),
    codePromo: promo.data
      ? { code: promo.data.code, reductionCents: promo.data.reduction_cents, reductionPct: Number(promo.data.reduction_pct), commissionPct: Number(promo.data.commission_pct) }
      : null,
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
      return { id: l.id, titre: produit?.titre_fr ?? l.pass_nom_fr ?? "", famille: produit?.famille ?? "", taille: variante?.taille ?? null, couleur: variante?.couleur_fr ?? null, nombre: l.nombre, prixCents: l.prix_cents, origine: l.origine, mesuresRecuesLe: l.mesures_recues_le };
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

export type TacheRemboursement = { type: "demande" | "remboursement" | "trop_percu" | "reclamation" | "stock" | "demande_pass" | "remboursement_pass"; numero: string; cibleId: string };

// Tâches d'argent (story 6.6) : demandes d'annulation ouvertes, remboursements d'annulation non confirmés, Trop-perçus à rembourser. Lecture impossible : erreur.
export async function lireTachesRemboursement(): Promise<TacheRemboursement[]> {
  const client = creerClientService();
  const [demandes, rembs, trops, reclamations, stocks, demandesPass, rembsPass] = await Promise.all([
    client.from("demande_client").select("id, commande:commande_id(numero)").eq("type", "annulation_commande").eq("statut", "ouverte"),
    client.from("remboursement").select("cible_id").eq("cible_type", "commande").is("valide_le", null),
    client.from("trop_percu").select("id, commande:commande_id(numero)").eq("statut", "a_rembourser"),
    client.from("demande_client").select("id, commande:commande_id(numero)").eq("type", "reclamation").in("statut", ["ouverte", "acceptee", "article_rendu"]),
    client.from("commande").select("id, numero").eq("stock_a_verifier", true),
    client.from("demande_client").select("id, commande:commande_id(numero)").eq("type", "annulation_pass").eq("statut", "ouverte"),
    client.from("remboursement").select("cible_id").eq("cible_type", "pass").is("valide_le", null),
  ]);
  if (demandes.error || rembs.error || trops.error || reclamations.error || stocks.error || demandesPass.error || rembsPass.error) throw new Error("lecture des tâches de remboursement impossible");
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
  for (const d of demandesPass.data ?? []) {
    const n = numero(d.commande);
    if (n) taches.push({ type: "demande_pass", numero: n, cibleId: d.id });
  }
  const idsRembPass = (rembsPass.data ?? []).map((r) => r.cible_id);
  if (idsRembPass.length > 0) {
    const { data, error } = await client.from("pass").select("id, commande:commande_id(numero)").in("id", idsRembPass);
    if (error) throw new Error("lecture des tâches de remboursement impossible");
    for (const p of data ?? []) {
      const n = numero(p.commande);
      if (n) taches.push({ type: "remboursement_pass", numero: n, cibleId: p.id });
    }
  }
  for (const c of stocks.data ?? []) taches.push({ type: "stock", numero: c.numero, cibleId: c.id });
  return taches;
}
