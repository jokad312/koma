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
  | "generique";

export type ResultatAdminCommande = { ok: true } | { ok: false; erreur: ErreurAdminCommande };

export type DependancesAdminCommande = {
  // Lève une erreur si le droit n'est pas accordé ; renvoie l'auteur (objet journalisé).
  exigerDroit: (droit: "commandes.voir" | "commandes.changer_statut" | "mesures.verifier") => Promise<{ auteur: unknown }>;
  corrigerAdresse: (auteur: unknown, numero: string, adresse: string) => Promise<{ erreur: string | null }>;
  avancerStatut: (auteur: unknown, numero: string, vers: string, numeroSuivi: string | null) => Promise<{ erreur: string | null }>;
  confirmerMesures: (auteur: unknown, ligneId: string) => Promise<{ erreur: string | null }>;
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
