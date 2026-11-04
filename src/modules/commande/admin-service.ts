import { z } from "zod";

// Écritures de l'admin sur les Commandes (stories 6.2, 6.3, 6.5). Le droit est vérifié ici ET dans la fonction SQL (rôle relu en base) ;
// le succès n'existe qu'après la réponse réelle de la base (règle 13).
export type ErreurAdminCommande =
  | "non_autorise"
  | "entree_invalide"
  | "commande_introuvable"
  | "pas_de_livraison"
  | "transition_interdite"
  | "mesures_non_recues"
  | "numero_suivi_invalide"
  | "mesures_deja_recues"
  | "pas_sur_mesure"
  | "annulation_impossible"
  | "demande_introuvable"
  | "demande_deja_traitee"
  | "preuve_requise"
  | "remboursement_impossible"
  | "stock_insuffisant"
  | "stock_invalide"
  | "etape_invalide"
  | "decision_invalide"
  | "type_non_pris_en_charge"
  | "remboursement_nul"
  | "quantite_invalide"
  | "stock_deja_verifie"
  | "generique";

export type ResultatAdminCommande = { ok: true } | { ok: false; erreur: ErreurAdminCommande };

export type DependancesAdminCommande = {
  // Lève une erreur si le droit n'est pas accordé ; renvoie l'auteur (objet journalisé).
  exigerDroit: (droit: "commandes.voir" | "commandes.changer_statut" | "mesures.verifier" | "remboursement.valider") => Promise<{ auteur: unknown }>;
  corrigerAdresse: (auteur: unknown, numero: string, adresse: string) => Promise<{ erreur: string | null }>;
  avancerStatut: (auteur: unknown, numero: string, vers: string, numeroSuivi: string | null) => Promise<{ erreur: string | null }>;
  confirmerMesures: (auteur: unknown, ligneId: string) => Promise<{ erreur: string | null }>;
  traiterDemande: (auteur: unknown, demandeId: string, decision: "accepter" | "refuser") => Promise<{ erreur: string | null }>;
  traiterReclamation: (auteur: unknown, demandeId: string, etape: string, depuisStock: boolean, quantite: number | null) => Promise<{ erreur: string | null }>;
  confirmerRemboursement: (auteur: unknown, cibleType: "commande" | "trop_percu", cibleId: string, preuve: string) => Promise<{ erreur: string | null }>;
  marquerStockVerifie: (auteur: unknown, commandeId: string) => Promise<{ erreur: string | null }>;
  invalider: () => void | Promise<void>;
};

export const NUMERO_COMMANDE = z.string().regex(/^KS-[0-9]{4}-[0-9]{6,}$/);

export function erreurBaseCommande(erreur: string): ErreurAdminCommande {
  const table: Array<[string, ErreurAdminCommande]> = [
    ["KS_DROIT_REFUSE", "non_autorise"],
    ["KS_AUTEUR_MANQUANT", "non_autorise"],
    ["KS_COMMANDE_INTROUVABLE", "commande_introuvable"],
    ["KS_PAS_DE_LIVRAISON", "pas_de_livraison"],
    ["KS_TRANSITION_INTERDITE", "transition_interdite"],
    ["KS_MESURES_NON_RECUES", "mesures_non_recues"],
    ["KS_SUIVI_INVALIDE", "numero_suivi_invalide"],
    ["KS_MESURES_DEJA_RECUES", "mesures_deja_recues"],
    ["KS_PAS_SUR_MESURE", "pas_sur_mesure"],
    ["KS_ADRESSE_INVALIDE", "entree_invalide"],
    ["KS_LIGNE_INTROUVABLE", "commande_introuvable"],
    ["KS_ANNULATION_IMPOSSIBLE", "annulation_impossible"],
    ["KS_DEMANDE_INTROUVABLE", "demande_introuvable"],
    ["KS_DEMANDE_DEJA_TRAITEE", "demande_deja_traitee"],
    ["KS_PREUVE_REQUISE", "preuve_requise"],
    ["KS_STOCK_INSUFFISANT", "stock_insuffisant"],
    ["KS_STOCK_INVALIDE", "stock_invalide"],
    ["KS_ETAPE_INVALIDE", "etape_invalide"],
    ["KS_DEPUIS_STOCK_INVALIDE", "etape_invalide"],
    ["KS_DECISION_INVALIDE", "decision_invalide"],
    ["KS_TYPE_NON_PRIS_EN_CHARGE", "type_non_pris_en_charge"],
    ["KS_REMBOURSEMENT_NUL", "remboursement_nul"],
    ["KS_QUANTITE_INVALIDE", "quantite_invalide"],
    ["KS_STOCK_DEJA_VERIFIE", "stock_deja_verifie"],
    ["KS_REMBOURSEMENT_IMPOSSIBLE", "remboursement_impossible"],
    ["KS_TROP_PERCU_INTROUVABLE", "remboursement_impossible"],
  ];
  return table.find(([code]) => erreur.includes(code))?.[1] ?? "generique";
}

async function autoriser(deps: DependancesAdminCommande, droit: Parameters<DependancesAdminCommande["exigerDroit"]>[0]): Promise<{ auteur: unknown } | null> {
  try {
    return await deps.exigerDroit(droit);
  } catch {
    return null;
  }
}

const adresseSchema = z.string().trim().min(1).max(500);

export async function corrigerAdresseCommande(deps: DependancesAdminCommande, entree: { numero: string; adresse: string }): Promise<ResultatAdminCommande> {
  const numero = NUMERO_COMMANDE.safeParse(entree.numero);
  const adresse = adresseSchema.safeParse(entree.adresse);
  if (!numero.success || !adresse.success) return { ok: false, erreur: "entree_invalide" };
  const droit = await autoriser(deps, "commandes.changer_statut");
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.corrigerAdresse(droit.auteur, numero.data, adresse.data);
    if (erreur) return { ok: false, erreur: erreurBaseCommande(erreur) };
    await deps.invalider();
    return { ok: true };
  } catch {
    console.error("[commande] correction d'adresse impossible");
    return { ok: false, erreur: "generique" };
  }
}

// Statuts que l'admin peut poser à la main : « payee », « offerte », « echouee » et « expiree » n'y figurent jamais (règle 2).
export const STATUTS_POSABLES = ["en_fabrication", "expediee", "livree"] as const;
export type StatutPosable = (typeof STATUTS_POSABLES)[number];

const suiviSchema = z.string().trim().min(1).max(100);

export async function avancerStatutCommande(deps: DependancesAdminCommande, entree: { numero: string; vers: string; numeroSuivi?: string | null }): Promise<ResultatAdminCommande> {
  const numero = NUMERO_COMMANDE.safeParse(entree.numero);
  const vers = (STATUTS_POSABLES as readonly string[]).includes(entree.vers) ? entree.vers : null;
  if (!numero.success || !vers) return { ok: false, erreur: "entree_invalide" };
  // Le numéro de suivi est facultatif et ne se saisit qu'à l'expédition ; texte libre, jamais transformé (règle 12).
  let suivi: string | null = null;
  if (entree.numeroSuivi !== undefined && entree.numeroSuivi !== null && entree.numeroSuivi.trim() !== "") {
    if (vers !== "expediee") return { ok: false, erreur: "numero_suivi_invalide" };
    const lu = suiviSchema.safeParse(entree.numeroSuivi);
    if (!lu.success) return { ok: false, erreur: "numero_suivi_invalide" };
    suivi = lu.data;
  }
  const droit = await autoriser(deps, "commandes.changer_statut");
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.avancerStatut(droit.auteur, numero.data, vers, suivi);
    if (erreur) return { ok: false, erreur: erreurBaseCommande(erreur) };
    await deps.invalider();
    return { ok: true };
  } catch {
    console.error("[commande] avancement de statut impossible");
    return { ok: false, erreur: "generique" };
  }
}

export async function confirmerMesuresRecues(deps: DependancesAdminCommande, entree: { ligneId: string }): Promise<ResultatAdminCommande> {
  const id = z.string().uuid().safeParse(entree.ligneId);
  if (!id.success) return { ok: false, erreur: "entree_invalide" };
  const droit = await autoriser(deps, "mesures.verifier");
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.confirmerMesures(droit.auteur, id.data);
    if (erreur) return { ok: false, erreur: erreurBaseCommande(erreur) };
    await deps.invalider();
    return { ok: true };
  } catch {
    console.error("[commande] confirmation des mesures impossible");
    return { ok: false, erreur: "generique" };
  }
}

// Demande d'annulation d'un client : l'admin accepte (la Commande est annulée et le montant à rendre figé) ou refuse (la Commande ne change pas).
export async function traiterDemandeClient(deps: DependancesAdminCommande, entree: { demandeId: string; decision: string }): Promise<ResultatAdminCommande> {
  const id = z.string().uuid().safeParse(entree.demandeId);
  const decision = entree.decision === "accepter" || entree.decision === "refuser" ? entree.decision : null;
  if (!id.success || !decision) return { ok: false, erreur: "entree_invalide" };
  const droit = await autoriser(deps, "remboursement.valider");
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.traiterDemande(droit.auteur, id.data, decision);
    if (erreur) return { ok: false, erreur: erreurBaseCommande(erreur) };
    await deps.invalider();
    return { ok: true };
  } catch {
    console.error("[commande] traitement d'une demande impossible");
    return { ok: false, erreur: "generique" };
  }
}

const preuveSchema = z.string().trim().min(3).max(200);

// Confirmation d'un remboursement : la preuve (référence du Prestataire ou du virement manuel) est exigée ; sans elle, rien n'est enregistré (UX-DR44).
export async function confirmerRemboursementAdmin(deps: DependancesAdminCommande, entree: { cibleType: string; cibleId: string; preuve: string }): Promise<ResultatAdminCommande> {
  const id = z.string().uuid().safeParse(entree.cibleId);
  const type = entree.cibleType === "commande" || entree.cibleType === "trop_percu" ? entree.cibleType : null;
  if (!id.success || !type) return { ok: false, erreur: "entree_invalide" };
  const preuve = preuveSchema.safeParse(entree.preuve);
  if (!preuve.success) return { ok: false, erreur: "preuve_requise" };
  const droit = await autoriser(deps, "remboursement.valider");
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.confirmerRemboursement(droit.auteur, type, id.data, preuve.data);
    if (erreur) return { ok: false, erreur: erreurBaseCommande(erreur) };
    await deps.invalider();
    return { ok: true };
  } catch {
    console.error("[commande] confirmation de remboursement impossible");
    return { ok: false, erreur: "generique" };
  }
}

export const ETAPES_RECLAMATION = ["accepter", "refuser", "article_rendu", "remplacement_remis"] as const;

// Réclamation (story 6.7) : accepter ou refuser, puis article rendu, puis remplacement remis (un remplacement pris en stock décompte le stock).
// La Commande reste « livree » et aucun remboursement n'est proposé.
export async function avancerReclamation(deps: DependancesAdminCommande, entree: { demandeId: string; etape: string; depuisStock?: boolean; quantite?: number }): Promise<ResultatAdminCommande> {
  const id = z.string().uuid().safeParse(entree.demandeId);
  const etape = (ETAPES_RECLAMATION as readonly string[]).includes(entree.etape) ? entree.etape : null;
  if (!id.success || !etape) return { ok: false, erreur: "entree_invalide" };
  // Quantité remplacée : entier d'au moins 1, seulement pour le remplacement remis ; la borne haute (quantité de la ligne) est vérifiée en base.
  if (entree.quantite !== undefined && (!Number.isInteger(entree.quantite) || entree.quantite < 1 || entree.quantite > 10000 || etape !== "remplacement_remis")) return { ok: false, erreur: "quantite_invalide" };
  const droit = await autoriser(deps, "remboursement.valider");
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.traiterReclamation(droit.auteur, id.data, etape, etape === "remplacement_remis" && entree.depuisStock === true, entree.quantite ?? null);
    if (erreur) return { ok: false, erreur: erreurBaseCommande(erreur) };
    await deps.invalider();
    return { ok: true };
  } catch {
    console.error("[commande] avancement d'une réclamation impossible");
    return { ok: false, erreur: "generique" };
  }
}

// Tâche « Vérifier le stock » (annulation d'une Commande dont la quantité retirée du stock était inconnue) : l'admin la ferme après avoir vérifié le stock à la main.
export async function marquerStockVerifieAdmin(deps: DependancesAdminCommande, entree: { commandeId: string }): Promise<ResultatAdminCommande> {
  const id = z.string().uuid().safeParse(entree.commandeId);
  if (!id.success) return { ok: false, erreur: "entree_invalide" };
  const droit = await autoriser(deps, "remboursement.valider");
  if (!droit) return { ok: false, erreur: "non_autorise" };
  try {
    const { erreur } = await deps.marquerStockVerifie(droit.auteur, id.data);
    if (erreur) return { ok: false, erreur: erreurBaseCommande(erreur) };
    await deps.invalider();
    return { ok: true };
  } catch {
    console.error("[commande] confirmation de la vérification du stock impossible");
    return { ok: false, erreur: "generique" };
  }
}
